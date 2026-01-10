/**
 * EventStore - IndexedDB-backed event storage
 */

import type { EventLog, EventLogType } from "@service-policy-auditor/detectors";
import { DB_CONFIG, initializeDatabase } from "./schema.js";

export interface EventQueryOptions {
  limit?: number;
  offset?: number;
  type?: EventLogType[];
  domain?: string;
  since?: number;
  until?: number;
  orderBy?: "timestamp" | "-timestamp";
}

export interface EventQueryResult {
  events: EventLog[];
  total: number;
  hasMore: boolean;
}

export class EventStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.db = await initializeDatabase();
    })();

    return this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("EventStore not initialized. Call init() first.");
    }
    return this.db;
  }

  async add(event: EventLog): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.add(event);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async addBatch(events: EventLog[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);

      events.forEach((event) => {
        store.add(event);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async query(options?: EventQueryOptions): Promise<EventQueryResult> {
    await this.init();

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? "-timestamp";

    const total = await this.count({
      type: options?.type,
      domain: options?.domain,
      since: options?.since,
      until: options?.until,
    });

    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);

      let index = store.index("timestamp");
      const range = this.buildRange(options?.since, options?.until);

      if (options?.type && options.type.length === 1) {
        index = store.index("type");
      }

      let request;
      if (options?.type && options.type.length === 1) {
        request = index.getAll(options.type[0]);
      } else if (options?.type && options.type.length > 1) {
        request = store.getAll();
      } else if (range) {
        request = index.getAll(range);
      } else {
        request = index.getAll();
      }

      request.onsuccess = () => {
        let results = request.result as EventLog[];

        if (options?.type && options.type.length > 0) {
          results = results.filter((e) => options.type!.includes(e.type));
        }
        if (options?.domain) {
          results = results.filter((e) => e.domain === options.domain);
        }

        results.sort((a, b) => b.timestamp - a.timestamp);
        const paged = results.slice(offset, offset + limit);

        resolve({
          events: paged,
          total,
          hasMore: offset + limit < results.length,
        });
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getById(id: string): Promise<EventLog | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readwrite");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async count(options?: {
    type?: EventLogType[];
    domain?: string;
    since?: number;
    until?: number;
  }): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result as EventLog[];

        if (options?.type && options.type.length > 0) {
          results = results.filter((e) => options.type!.includes(e.type));
        }
        if (options?.domain) {
          results = results.filter((e) => e.domain === options.domain);
        }
        if (options?.since) {
          results = results.filter((e) => e.timestamp >= options.since!);
        }
        if (options?.until) {
          results = results.filter((e) => e.timestamp <= options.until!);
        }

        resolve(results.length);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async exportAll(): Promise<EventLog[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([DB_CONFIG.stores.events.name], "readonly");
      const store = tx.objectStore(DB_CONFIG.stores.events.name);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as EventLog[];
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  private buildRange(since?: number, until?: number): IDBKeyRange | null {
    if (since && until) {
      return IDBKeyRange.bound(since, until);
    }
    if (since) {
      return IDBKeyRange.lowerBound(since);
    }
    if (until) {
      return IDBKeyRange.upperBound(until);
    }
    return null;
  }
}
