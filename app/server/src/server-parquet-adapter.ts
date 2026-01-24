import type {
  CSPReport,
  CSPViolation,
  NetworkRequest,
} from "@pleno-audit/csp";
import type { ParquetFileRecord, ParquetLogType } from "@pleno-audit/parquet-storage";
import {
  cspViolationToParquetRecord,
  networkRequestToParquetRecord,
  parquetRecordToCspViolation,
  parquetRecordToNetworkRequest,
  getDateString,
} from "@pleno-audit/parquet-storage";
import type { FileSystemAdapter } from "./filesystem-adapter";

interface DatabaseStats {
  violations: number;
  requests: number;
  uniqueDomains: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
  domain?: string;
}

export class ServerParquetAdapter {
  private storage: FileSystemAdapter;
  private writeBuffer: Map<string, unknown[]> = new Map();
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL = 5000;
  private readonly BUFFER_SIZE = 100;

  constructor(storage: FileSystemAdapter) {
    this.storage = storage;
  }

  async init(): Promise<void> {
    await this.storage.init();
    console.log("[ServerParquetAdapter] Initialized with FileSystem storage");
  }

  async insertReports(reports: CSPReport[]): Promise<void> {
    const violations = reports.filter((r) => r.type === "csp-violation");
    const requests = reports.filter((r) => r.type === "network-request");

    if (violations.length > 0) {
      const parquetRecords = violations.map((v) =>
        cspViolationToParquetRecord(v as CSPViolation)
      );
      await this.bufferWrite("csp-violations", parquetRecords);
    }

    if (requests.length > 0) {
      const parquetRecords = requests.map((r) =>
        networkRequestToParquetRecord(r as NetworkRequest)
      );
      await this.bufferWrite("network-requests", parquetRecords);
    }
  }

  private async bufferWrite(type: ParquetLogType, records: unknown[]): Promise<void> {
    const key = `${type}-${getDateString(new Date())}`;
    const existing = this.writeBuffer.get(key) || [];
    existing.push(...records);
    this.writeBuffer.set(key, existing);

    if (existing.length >= this.BUFFER_SIZE) {
      await this.flushBuffer(type, key);
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(async () => {
      this.flushTimeout = null;
      await this.flushAll();
    }, this.FLUSH_INTERVAL);
  }

  private async flushBuffer(type: ParquetLogType, key: string): Promise<void> {
    const records = this.writeBuffer.get(key);
    if (!records || records.length === 0) return;

    const date = key.split("-").slice(-3).join("-"); // Extract date from key
    const existingRecord = await this.storage.load(key);
    let allRecords = records;

    if (existingRecord) {
      const existingData = this.deserializeData(existingRecord.data);
      allRecords = [...existingData, ...records];
    }

    const data = this.serializeData(allRecords);
    const record: ParquetFileRecord = {
      key,
      type,
      date,
      data,
      recordCount: allRecords.length,
      sizeBytes: data.byteLength,
      createdAt: existingRecord?.createdAt ?? Date.now(),
      lastModified: Date.now(),
    };

    await this.storage.save(record);
    this.writeBuffer.delete(key);
  }

  private async flushAll(): Promise<void> {
    for (const [key] of this.writeBuffer) {
      const type = key.split("-")[0] as ParquetLogType;
      await this.flushBuffer(type, key);
    }
  }

  async getAllReports(): Promise<CSPReport[]> {
    await this.flushAll();
    const violations = await this.getAllViolations();
    const requests = await this.getAllNetworkRequests();
    return [...violations, ...requests];
  }

  async getAllViolations(): Promise<CSPViolation[]> {
    await this.flushAll();
    const records = await this.storage.listByType("csp-violations");
    const violations: CSPViolation[] = [];

    for (const record of records) {
      const data = this.deserializeData(record.data);
      for (const item of data) {
        violations.push(parquetRecordToCspViolation(item as Record<string, unknown>));
      }
    }

    return violations.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAllNetworkRequests(): Promise<NetworkRequest[]> {
    await this.flushAll();
    const records = await this.storage.listByType("network-requests");
    const requests: NetworkRequest[] = [];

    for (const record of records) {
      const data = this.deserializeData(record.data);
      for (const item of data) {
        requests.push(parquetRecordToNetworkRequest(item as Record<string, unknown>));
      }
    }

    return requests.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getReportsSince(timestamp: string): Promise<CSPReport[]> {
    const since = new Date(timestamp).getTime();
    const all = await this.getAllReports();
    return all.filter((r) => r.timestamp >= since);
  }

  async getReports(options?: QueryOptions): Promise<PaginatedResult<CSPReport>> {
    let data = await this.getAllReports();

    if (options?.since) {
      const since = new Date(options.since).getTime();
      data = data.filter((r) => r.timestamp >= since);
    }

    if (options?.until) {
      const until = new Date(options.until).getTime();
      data = data.filter((r) => r.timestamp <= until);
    }

    if (options?.domain) {
      data = data.filter((r) => r.domain === options.domain);
    }

    const total = data.length;
    const offset = options?.offset || 0;
    const limit = options?.limit === -1 ? data.length : (options?.limit || 100);

    data = data.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  async getViolations(options?: QueryOptions): Promise<PaginatedResult<CSPViolation>> {
    let data = await this.getAllViolations();

    if (options?.since) {
      const since = new Date(options.since).getTime();
      data = data.filter((r) => r.timestamp >= since);
    }

    if (options?.until) {
      const until = new Date(options.until).getTime();
      data = data.filter((r) => r.timestamp <= until);
    }

    if (options?.domain) {
      data = data.filter((r) => r.domain === options.domain);
    }

    const total = data.length;
    const offset = options?.offset || 0;
    const limit = options?.limit === -1 ? data.length : (options?.limit || 100);

    data = data.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  async getNetworkRequests(options?: QueryOptions): Promise<PaginatedResult<NetworkRequest>> {
    let data = await this.getAllNetworkRequests();

    if (options?.since) {
      const since = new Date(options.since).getTime();
      data = data.filter((r) => r.timestamp >= since);
    }

    if (options?.until) {
      const until = new Date(options.until).getTime();
      data = data.filter((r) => r.timestamp <= until);
    }

    if (options?.domain) {
      data = data.filter((r) => r.domain === options.domain);
    }

    const total = data.length;
    const offset = options?.offset || 0;
    const limit = options?.limit === -1 ? data.length : (options?.limit || 100);

    data = data.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  async getStats(): Promise<DatabaseStats> {
    await this.flushAll();
    const violations = await this.getAllViolations();
    const requests = await this.getAllNetworkRequests();

    const uniqueDomains = new Set<string>();
    violations.forEach((v) => uniqueDomains.add(v.domain));
    requests.forEach((r) => uniqueDomains.add(r.domain));

    return {
      violations: violations.length,
      requests: requests.length,
      uniqueDomains: uniqueDomains.size,
    };
  }

  async deleteOldReports(beforeTimestamp: string): Promise<number> {
    await this.flushAll();
    const beforeDate = new Date(beforeTimestamp).toISOString().split("T")[0];

    const deletedViolations = await this.storage.deleteBeforeDate(
      "csp-violations",
      beforeDate
    );
    const deletedRequests = await this.storage.deleteBeforeDate(
      "network-requests",
      beforeDate
    );

    return deletedViolations + deletedRequests;
  }

  async clearAll(): Promise<void> {
    await this.storage.clear();
    this.writeBuffer.clear();
    console.log("[ServerParquetAdapter] All data cleared");
  }

  async close(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    await this.flushAll();
    console.log("[ServerParquetAdapter] Closed");
  }

  private serializeData(records: unknown[]): Uint8Array {
    const json = JSON.stringify(records);
    return new TextEncoder().encode(json);
  }

  private deserializeData(data: Uint8Array): Record<string, unknown>[] {
    const json = new TextDecoder().decode(data);
    return JSON.parse(json);
  }
}
