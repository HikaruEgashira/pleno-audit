import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type {
  ParquetLogType,
  QueryOptions,
  PaginatedResult,
  DatabaseStats,
  ParquetEvent,
  ParquetFileRecord,
} from "./types";
import { WriteBuffer } from "./write-buffer";
import { ParquetIndexedDBAdapter } from "./indexeddb-adapter";
import { DynamicIndexCache, DynamicIndexBuilder } from "./dynamic-index";
import { QueryEngine } from "./query-engine";
import {
  cspViolationToParquetRecord,
  networkRequestToParquetRecord,
  eventToParquetRecord,
  getDateString,
  getParquetFileName,
} from "./schema";

// parquet-wasmのインターフェース
interface ParquetTable {
  toBytes?(): Uint8Array;
  writeFile?(): ArrayBuffer;
  toJSON?(): Record<string, unknown>[];
}

interface ParquetWasm {
  Table?: {
    fromJSON(data: Record<string, unknown>[]): ParquetTable;
    fromBytes(data: Uint8Array): ParquetTable;
  };
  default?: () => Promise<void>;
}

export class ParquetStore {
  private indexedDB: ParquetIndexedDBAdapter;
  private writeBuffer: WriteBuffer<unknown>;
  private indexCache: DynamicIndexCache;
  private indexBuilder: DynamicIndexBuilder;
  private queryEngine: QueryEngine;
  private parquetWasm: ParquetWasm | null = null;
  private wasmInitialized = false;

  constructor() {
    this.indexedDB = new ParquetIndexedDBAdapter();
    this.indexCache = new DynamicIndexCache();
    this.indexBuilder = new DynamicIndexBuilder();
    this.queryEngine = new QueryEngine();
    this.writeBuffer = new WriteBuffer((type, records, date) =>
      this.flushBuffer(type, records, date)
    );
  }

  async init(): Promise<void> {
    // IndexedDBを初期化
    await this.indexedDB.init();
    // parquet-wasmを初期化
    await this.initParquetWasm();
  }

  private async initParquetWasm(): Promise<void> {
    try {
      // parquet-wasmを動的インポート
      const wasmModule = await import("parquet-wasm");
      this.parquetWasm = wasmModule;

      // WASMの初期化（必要な場合）
      if (wasmModule.default && typeof wasmModule.default === "function") {
        await wasmModule.default();
      }

      this.wasmInitialized = true;
    } catch (error) {
      console.warn("parquet-wasm initialization failed, falling back to JSON", error);
      this.parquetWasm = null;
      this.wasmInitialized = false;
    }
  }

  async write(type: ParquetLogType, records: unknown[]): Promise<void> {
    await this.writeBuffer.add(type, records);
  }

  private async flushBuffer(
    type: ParquetLogType,
    records: unknown[],
    date: string
  ): Promise<void> {
    if (records.length === 0) return;

    const fileName = getParquetFileName(type, date);
    const key = `${type}-${date}`;

    // 既存ファイルがあれば読み込み
    let existingRecord = await this.indexedDB.load(key);
    let allRecords = records;

    if (existingRecord) {
      // 既存データとマージ
      const existingData = this.deserializeParquetData(existingRecord.data);
      allRecords = [...existingData, ...records];
    }

    // Parquetエンコード
    const parquetBytes = await this.encodeParquet(type, allRecords);

    // IndexedDBに保存
    const record: ParquetFileRecord = {
      key,
      type,
      date,
      data: parquetBytes,
      recordCount: allRecords.length,
      sizeBytes: parquetBytes.byteLength,
      createdAt: existingRecord?.createdAt ?? Date.now(),
      lastModified: Date.now(),
    };

    await this.indexedDB.save(record);

    // インデックスキャッシュを無効化
    this.indexCache.clear();
  }

  async getReports(options?: QueryOptions): Promise<PaginatedResult<CSPReport>> {
    const dateRange = this.getDateRange(options);
    const cspViolations = await this.loadDataForType(
      "csp-violations",
      dateRange.start,
      dateRange.end
    );
    const networkRequests = await this.loadDataForType(
      "network-requests",
      dateRange.start,
      dateRange.end
    );

    const index = this.indexBuilder.buildIndex(
      cspViolations,
      networkRequests,
      [],
      dateRange.startMs,
      dateRange.endMs
    );

    return this.queryEngine.queryReports(
      cspViolations,
      networkRequests,
      index,
      options
    );
  }

  async getViolations(
    options?: QueryOptions
  ): Promise<PaginatedResult<CSPViolation>> {
    const dateRange = this.getDateRange(options);
    const cspViolations = await this.loadDataForType(
      "csp-violations",
      dateRange.start,
      dateRange.end
    );

    const index = this.indexBuilder.buildIndex(cspViolations, [], [], dateRange.startMs, dateRange.endMs);
    return this.queryEngine.queryViolations(cspViolations, index, options);
  }

  async getNetworkRequests(
    options?: QueryOptions
  ): Promise<PaginatedResult<NetworkRequest>> {
    const dateRange = this.getDateRange(options);
    const networkRequests = await this.loadDataForType(
      "network-requests",
      dateRange.start,
      dateRange.end
    );

    const index = this.indexBuilder.buildIndex([], networkRequests, [], dateRange.startMs, dateRange.endMs);
    return this.queryEngine.queryNetworkRequests(networkRequests, index, options);
  }

  async getEvents(
    options?: QueryOptions
  ): Promise<PaginatedResult<ParquetEvent>> {
    const dateRange = this.getDateRange(options);
    const events = await this.loadDataForType(
      "events",
      dateRange.start,
      dateRange.end
    );

    const index = this.indexBuilder.buildIndex([], [], events, dateRange.startMs, dateRange.endMs);
    return this.queryEngine.queryEvents(events, index, options);
  }

  async getStats(options?: { since?: string; until?: string }): Promise<DatabaseStats> {
    const dateRange = this.getDateRange(options);
    const cspViolations = await this.loadDataForType(
      "csp-violations",
      dateRange.start,
      dateRange.end
    );
    const networkRequests = await this.loadDataForType(
      "network-requests",
      dateRange.start,
      dateRange.end
    );

    const uniqueDomains = new Set<string>();
    cspViolations.forEach((v) => {
      uniqueDomains.add((v as any).domain as string);
    });
    networkRequests.forEach((r) => {
      uniqueDomains.add((r as any).domain as string);
    });

    return {
      violations: cspViolations.length,
      requests: networkRequests.length,
      uniqueDomains: uniqueDomains.size,
    };
  }

  async insertReports(reports: CSPReport[]): Promise<void> {
    const violations = reports.filter((r) => r.type === "csp-violation");
    const requests = reports.filter((r) => r.type === "network-request");

    if (violations.length > 0) {
      const parquetRecords = violations.map((v) =>
        cspViolationToParquetRecord(v as CSPViolation)
      );
      await this.write("csp-violations", parquetRecords);
    }

    if (requests.length > 0) {
      const parquetRecords = requests.map((r) =>
        networkRequestToParquetRecord(r as NetworkRequest)
      );
      await this.write("network-requests", parquetRecords);
    }
  }

  async addEvents(events: Omit<ParquetEvent, "id">[]): Promise<void> {
    const parquetRecords = events.map((e) =>
      eventToParquetRecord(e)
    );
    await this.write("events", parquetRecords);
  }

  async deleteOldReports(beforeDate: string): Promise<number> {
    await this.writeBuffer.flushAll();

    const deletedViolations = await this.indexedDB.deleteBeforeDate(
      "csp-violations",
      beforeDate
    );
    const deletedRequests = await this.indexedDB.deleteBeforeDate(
      "network-requests",
      beforeDate
    );
    const deletedEvents = await this.indexedDB.deleteBeforeDate("events", beforeDate);

    this.indexCache.clear();
    return deletedViolations + deletedRequests + deletedEvents;
  }

  async clearAll(): Promise<void> {
    await this.writeBuffer.flushAll();
    await this.indexedDB.clear();
    this.indexCache.clear();
  }

  private async loadDataForType(
    type: ParquetLogType,
    startDate: string,
    endDate: string
  ): Promise<Record<string, unknown>[]> {
    const records = await this.indexedDB.listByDateRange(type, startDate, endDate);
    const allData: Record<string, unknown>[] = [];

    for (const record of records) {
      const data = this.deserializeParquetData(record.data);
      allData.push(...data);
    }

    return allData;
  }

  private async encodeParquet(
    type: ParquetLogType,
    records: unknown[]
  ): Promise<Uint8Array> {
    // parquet-wasmが利用可能な場合はそれを使用、失敗時はJSON形式でフォールバック
    if (this.wasmInitialized && this.parquetWasm?.Table) {
      try {
        // parquet-wasmを使用してParquetファイルをエンコード
        const table = this.parquetWasm.Table.fromJSON(records as Record<string, unknown>[]);
        // tableをバイトに変換
        if (table && typeof table.toBytes === "function") {
          return table.toBytes();
        }
        // toBytes()が無い場合はwriteFileフォーマットで
        if (table && typeof table.writeFile === "function") {
          const buffer = table.writeFile();
          return new Uint8Array(buffer);
        }
      } catch (error) {
        console.warn("parquet-wasm encoding failed, falling back to JSON", error);
        // フォールバック: JSON形式で保存
      }
    }

    // フォールバック: JSON形式で保存
    const json = JSON.stringify(records);
    return new TextEncoder().encode(json);
  }

  private deserializeParquetData(
    data: Uint8Array
  ): Record<string, unknown>[] {
    // parquet-wasmが利用可能な場合はそれを使用
    if (this.wasmInitialized && this.parquetWasm?.Table) {
      try {
        // Parquetバイナリをparquet-wasmでデコード
        const table = this.parquetWasm.Table.fromBytes(data);
        if (table && typeof table.toJSON === "function") {
          return table.toJSON() as Record<string, unknown>[];
        }
      } catch (error) {
        console.warn("parquet-wasm decoding failed, falling back to JSON", error);
        // フォールバック: JSON形式で復元
      }
    }

    // フォールバック: JSON形式で復元
    const json = new TextDecoder().decode(data);
    return JSON.parse(json) as Record<string, unknown>[];
  }

  private getDateRange(
    options?: QueryOptions
  ): {
    start: string;
    end: string;
    startMs: number;
    endMs: number;
  } {
    const now = new Date();
    const endDate = options?.until ? new Date(options.until) : now;
    const startDate = options?.since
      ? new Date(options.since)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // デフォルト30日

    return {
      start: getDateString(startDate),
      end: getDateString(endDate),
      startMs: startDate.getTime(),
      endMs: endDate.getTime(),
    };
  }
}
