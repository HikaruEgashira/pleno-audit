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
import type { StorageAdapter } from "./storage-adapter";

/**
 * データベース統計情報
 */
interface DatabaseStats {
  /** CSP違反の総数 */
  violations: number;
  /** ネットワークリクエストの総数 */
  requests: number;
  /** ユニークドメインの総数 */
  uniqueDomains: number;
}

/**
 * ページネーション付きのクエリ結果
 * @template T データの型
 */
interface PaginatedResult<T> {
  /** 結果データの配列 */
  data: T[];
  /** 総レコード数 */
  total: number;
  /** 更にデータがあるか */
  hasMore: boolean;
}

/**
 * クエリオプション
 */
interface QueryOptions {
  /** 取得件数（-1で無制限） */
  limit?: number;
  /** オフセット */
  offset?: number;
  /** 開始日時（ISO形式） */
  since?: string;
  /** 終了日時（ISO形式） */
  until?: string;
  /** フィルターするドメイン */
  domain?: string;
}

/**
 * サーバー環境向けのParquetストレージアダプター。
 * CSPレポートとネットワークリクエストをFileSystemAdapterを使用して永続化する。
 * 書き込みバッファリング機能を持ち、100件または5秒でフラッシュする。
 */
export class ServerParquetAdapter {
  private storage: StorageAdapter;
  private writeBuffer: Map<string, unknown[]> = new Map();
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL = 5000;
  private readonly BUFFER_SIZE = 100;

  /**
   * ServerParquetAdapterのインスタンスを作成する。
   * @param storage - StorageAdapterインスタンス（FileSystemAdapter または S3StorageAdapter）
   */
  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * アダプターを初期化する。
   */
  async init(): Promise<void> {
    await this.storage.init();
    console.log("[ServerParquetAdapter] Initialized with FileSystem storage");
  }

  /**
   * CSPレポートを挿入する。
   * 違反とネットワークリクエストを自動的に分類してバッファに追加する。
   * @param reports - 挿入するCSPレポートの配列
   */
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

  /**
   * 指定されたキーのバッファをストレージにフラッシュする。
   * 並行性を考慮し、バッファエントリを即座に分離してから非同期I/Oを実行する。
   * @param type - Parquetログタイプ
   * @param key - バッファキー
   */
  private async flushBuffer(type: ParquetLogType, key: string): Promise<void> {
    const records = this.writeBuffer.get(key);
    if (!records || records.length === 0) return;

    // 並行性対策: バッファを即座に分離し、新しい空の配列をセット
    // これにより、フラッシュ中の新しい書き込みは別の配列に追加される
    this.writeBuffer.set(key, []);

    const date = key.split("-").slice(-3).join("-"); // Extract date from key

    try {
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

      // 成功後、空のバッファエントリがあれば削除
      const currentBuffer = this.writeBuffer.get(key);
      if (currentBuffer && currentBuffer.length === 0) {
        this.writeBuffer.delete(key);
      }
    } catch (error) {
      // 失敗時: 分離したレコードを現在のバッファにマージして再キュー
      const currentBuffer = this.writeBuffer.get(key) || [];
      this.writeBuffer.set(key, [...records, ...currentBuffer]);
      this.scheduleFlush();
      console.error(`[ServerParquetAdapter] Failed to flush buffer for ${key}:`, error);
    }
  }

  private async flushAll(): Promise<void> {
    for (const [key] of this.writeBuffer) {
      // keyの形式: "${type}-${YYYY-MM-DD}" (例: "csp-violations-2026-01-24")
      // 末尾の日付部分を除去してtypeを取得
      const type = key.replace(/-\d{4}-\d{2}-\d{2}$/, "") as ParquetLogType;
      await this.flushBuffer(type, key);
    }
  }

  /**
   * 全てのCSPレポート（違反とネットワークリクエスト）を取得する。
   * @returns CSPレポートの配列（タイムスタンプ降順）
   */
  async getAllReports(): Promise<CSPReport[]> {
    await this.flushAll();
    const violations = await this.getAllViolations();
    const requests = await this.getAllNetworkRequests();
    // ページネーションの一貫性のためにタイムスタンプでソート
    return [...violations, ...requests].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 全てのCSP違反を取得する。
   * @returns CSP違反の配列（タイムスタンプ降順）
   */
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

  /**
   * 全てのネットワークリクエストを取得する。
   * @returns ネットワークリクエストの配列（タイムスタンプ降順）
   */
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

  /**
   * 指定したタイムスタンプ以降のレポートを取得する。
   * @param timestamp - ISO形式のタイムスタンプ
   * @returns 該当するCSPレポートの配列
   */
  async getReportsSince(timestamp: string): Promise<CSPReport[]> {
    const since = new Date(timestamp).getTime();
    const all = await this.getAllReports();
    return all.filter((r) => r.timestamp >= since);
  }

  /**
   * フィルター条件に基づいてCSPレポートを取得する。
   * @param options - クエリオプション
   * @returns ページネーション付きの結果
   */
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

  /**
   * フィルター条件に基づいてCSP違反を取得する。
   * @param options - クエリオプション
   * @returns ページネーション付きの結果
   */
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

  /**
   * フィルター条件に基づいてネットワークリクエストを取得する。
   * @param options - クエリオプション
   * @returns ページネーション付きの結果
   */
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

  /**
   * データベースの統計情報を取得する。
   * @returns 違反数、リクエスト数、ユニークドメイン数を含む統計情報
   */
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

  /**
   * 指定した日時より前のレポートを削除する。
   * @param beforeTimestamp - ISO形式のタイムスタンプ
   * @returns 削除されたレコード数
   */
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

  /**
   * 全てのデータをクリアする。
   */
  async clearAll(): Promise<void> {
    await this.storage.clear();
    this.writeBuffer.clear();
    console.log("[ServerParquetAdapter] All data cleared");
  }

  /**
   * アダプターをクローズする。
   * 保留中のバッファをフラッシュし、タイマーをクリアする。
   */
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
