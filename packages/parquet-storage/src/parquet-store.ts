import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type {
  ParquetLogType,
  QueryOptions,
  PaginatedResult,
  DatabaseStats,
  ParquetEvent,
  ParquetFileRecord,
  ExportOptions,
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
} from "./schema";
import {
  encodeToParquet,
  decodeFromParquet,
  isParquetWasmAvailable,
} from "./parquet-encoder";
import { PartitionManager, type CompactionResult } from "./partition-manager";

// 保持ポリシー設定
export interface RetentionPolicy {
  maxAgeDays: number; // データの最大保持日数（デフォルト: 730日 = 2年）
  enabled: boolean;
}

// 容量監視設定
export interface CapacityConfig {
  maxSizeBytes: number; // IndexedDBの最大使用量
  warningThreshold: number; // 警告閾値（0.0-1.0）
}

// 容量情報
export interface CapacityInfo {
  usedBytes: number;
  maxBytes: number;
  usagePercent: number;
  isWarning: boolean;
  isFull: boolean;
}

export class ParquetStore {
  private indexedDB: ParquetIndexedDBAdapter;
  private writeBuffer: WriteBuffer<unknown>;
  private indexCache: DynamicIndexCache;
  private indexBuilder: DynamicIndexBuilder;
  private queryEngine: QueryEngine;
  private partitionManager: PartitionManager;

  // 保持ポリシー（デフォルト: 2年）
  private retentionPolicy: RetentionPolicy = {
    maxAgeDays: 730,
    enabled: true,
  };

  // 容量設定（デフォルト: 2GB）
  private capacityConfig: CapacityConfig = {
    maxSizeBytes: 2 * 1024 * 1024 * 1024,
    warningThreshold: 0.8,
  };

  constructor() {
    this.indexedDB = new ParquetIndexedDBAdapter();
    this.indexCache = new DynamicIndexCache();
    this.indexBuilder = new DynamicIndexBuilder();
    this.queryEngine = new QueryEngine();
    this.partitionManager = new PartitionManager();
    this.writeBuffer = new WriteBuffer((type, records, date) =>
      this.flushBuffer(type, records, date)
    );
  }

  async init(): Promise<void> {
    // IndexedDBを初期化
    await this.indexedDB.init();
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

    const key = `${type}-${date}`;

    // 既存ファイルがあれば読み込み
    let existingRecord = await this.indexedDB.load(key);
    let allRecords = records;

    if (existingRecord) {
      // 既存データとマージ
      const existingData = await this.deserializeParquetData(existingRecord.data);
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
      const data = await this.deserializeParquetData(record.data);
      allData.push(...data);
    }

    return allData;
  }

  private async encodeParquet(
    type: ParquetLogType,
    records: unknown[]
  ): Promise<Uint8Array> {
    // parquet-wasmでエンコード（失敗時はJSONフォールバック）
    return encodeToParquet(type, records as Record<string, unknown>[]);
  }

  private async deserializeParquetData(
    data: Uint8Array
  ): Promise<Record<string, unknown>[]> {
    // parquet-wasmでデコード（Parquetフォーマットでない場合はJSONとして解析）
    return decodeFromParquet(data);
  }

  // parquet-wasmが利用可能かチェック
  async isParquetSupported(): Promise<boolean> {
    return isParquetWasmAvailable();
  }

  // Parquetファイルをエクスポート
  async exportToParquet(options?: ExportOptions): Promise<Map<string, Uint8Array>> {
    await this.writeBuffer.flushAll();

    const result = new Map<string, Uint8Array>();
    const types = options?.type ? [options.type] : ["csp-violations", "network-requests", "events", "ai-prompts"] as ParquetLogType[];

    const dateRange = this.getDateRange({
      since: options?.since,
      until: options?.until,
    });

    for (const type of types) {
      const records = await this.indexedDB.listByDateRange(
        type,
        dateRange.start,
        dateRange.end
      );

      for (const record of records) {
        result.set(record.key, record.data);
      }
    }

    return result;
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

  // === Phase 4: 運用機能 ===

  // 保持ポリシーを設定
  setRetentionPolicy(policy: Partial<RetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
  }

  // 保持ポリシーを取得
  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  // 容量設定を更新
  setCapacityConfig(config: Partial<CapacityConfig>): void {
    this.capacityConfig = { ...this.capacityConfig, ...config };
  }

  // 容量情報を取得
  async getCapacityInfo(): Promise<CapacityInfo> {
    const usedBytes = await this.indexedDB.getSize();
    const maxBytes = this.capacityConfig.maxSizeBytes;
    const usagePercent = usedBytes / maxBytes;

    return {
      usedBytes,
      maxBytes,
      usagePercent,
      isWarning: usagePercent >= this.capacityConfig.warningThreshold,
      isFull: usagePercent >= 1.0,
    };
  }

  // 保持ポリシーを適用（古いデータを削除）
  async applyRetentionPolicy(): Promise<number> {
    if (!this.retentionPolicy.enabled) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionPolicy.maxAgeDays);
    const cutoffDateStr = getDateString(cutoffDate);

    return this.deleteOldReports(cutoffDateStr);
  }

  // 自動コンパクション（小さなパーティションを結合）
  async compactPartitions(
    type: ParquetLogType,
    targetMonth?: string
  ): Promise<CompactionResult> {
    await this.writeBuffer.flushAll();

    // 小さなパーティション（100KB未満）を取得
    const smallPartitions = this.partitionManager.getSmallPartitions(type);

    if (smallPartitions.length < 2) {
      return {
        compactedPartitions: 0,
        reducedSizeBytes: 0,
        timestamp: Date.now(),
      };
    }

    // 月ごとにグループ化
    const monthGroups = new Map<string, typeof smallPartitions>();
    for (const partition of smallPartitions) {
      const month = partition.date.substring(0, 7);
      if (targetMonth && month !== targetMonth) continue;

      if (!monthGroups.has(month)) {
        monthGroups.set(month, []);
      }
      monthGroups.get(month)!.push(partition);
    }

    let compactedPartitions = 0;
    let reducedSizeBytes = 0;

    // 各月のパーティションを結合
    for (const [, partitions] of monthGroups) {
      if (partitions.length < 2) continue;

      // 全レコードを読み込み
      const allRecords: Record<string, unknown>[] = [];
      let totalOriginalSize = 0;

      for (const partition of partitions) {
        const record = await this.indexedDB.load(partition.key);
        if (record) {
          const data = await this.deserializeParquetData(record.data);
          allRecords.push(...data);
          totalOriginalSize += record.sizeBytes;
        }
      }

      if (allRecords.length === 0) continue;

      // 最初のパーティションの日付を使用
      const targetDate = partitions[0].date;
      const newKey = `${type}-${targetDate}`;

      // 新しいパーティションを作成
      const newData = await this.encodeParquet(type, allRecords);
      const newRecord: ParquetFileRecord = {
        key: newKey,
        type,
        date: targetDate,
        data: newData,
        recordCount: allRecords.length,
        sizeBytes: newData.byteLength,
        createdAt: Date.now(),
        lastModified: Date.now(),
      };

      await this.indexedDB.save(newRecord);

      // 古いパーティションを削除（最初のもの以外）
      for (let i = 1; i < partitions.length; i++) {
        await this.indexedDB.delete(partitions[i].key);
        this.partitionManager.removePartition(partitions[i].key);
      }

      // パーティション情報を更新
      this.partitionManager.updatePartitionInfo(newRecord);

      compactedPartitions += partitions.length;
      reducedSizeBytes += totalOriginalSize - newData.byteLength;
    }

    this.indexCache.clear();

    return {
      compactedPartitions,
      reducedSizeBytes,
      timestamp: Date.now(),
    };
  }

  // Parquetファイルをインポート
  async importFromParquet(
    key: string,
    type: ParquetLogType,
    date: string,
    data: Uint8Array
  ): Promise<{ success: boolean; recordCount: number }> {
    try {
      // データをデコードして検証
      const records = await this.deserializeParquetData(data);

      if (records.length === 0) {
        return { success: false, recordCount: 0 };
      }

      // 既存データがあればマージ
      const existingRecord = await this.indexedDB.load(key);
      let allRecords = records;

      if (existingRecord) {
        const existingData = await this.deserializeParquetData(existingRecord.data);
        allRecords = [...existingData, ...records];
      }

      // 再エンコード（統一フォーマット）
      const newData = await this.encodeParquet(type, allRecords);

      const record: ParquetFileRecord = {
        key,
        type,
        date,
        data: newData,
        recordCount: allRecords.length,
        sizeBytes: newData.byteLength,
        createdAt: existingRecord?.createdAt ?? Date.now(),
        lastModified: Date.now(),
      };

      await this.indexedDB.save(record);
      this.partitionManager.updatePartitionInfo(record);
      this.indexCache.clear();

      return { success: true, recordCount: records.length };
    } catch {
      return { success: false, recordCount: 0 };
    }
  }

  // パーティション統計を取得
  getPartitionStats() {
    return this.partitionManager.getStats();
  }

  // 月別統計を取得
  getMonthlyStats() {
    return this.partitionManager.getMonthlyStats();
  }

  // 古いパーティション一覧を取得
  getOldPartitions(days: number = 730) {
    return this.partitionManager.getPartitionsOlderThan(days);
  }
}
