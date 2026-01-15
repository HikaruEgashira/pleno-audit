import type { CSPViolation, NetworkRequest, CSPReport } from "@pleno-audit/csp";
import type { ParquetEvent, QueryOptions, PaginatedResult, DynamicIndex, ParquetLogType } from "./types";
import {
  parquetRecordToCspViolation,
  parquetRecordToNetworkRequest,
  parquetRecordToEvent,
} from "./schema";

// 列プルーニング: 各タイプで必要な列を定義
export const REQUIRED_COLUMNS: Record<ParquetLogType, string[]> = {
  "csp-violations": [
    "timestamp",
    "pageUrl",
    "directive",
    "blockedURL",
    "domain",
    "disposition",
    "originalPolicy",
    "sourceFile",
    "lineNumber",
    "columnNumber",
    "statusCode",
  ],
  "network-requests": [
    "timestamp",
    "pageUrl",
    "url",
    "method",
    "initiator",
    "domain",
    "resourceType",
  ],
  events: ["id", "type", "domain", "timestamp", "details"],
  "ai-prompts": ["id", "timestamp", "url", "prompt", "service"],
};

// クエリで使用する列のみを取得（列プルーニング用）
export function getColumnsForQuery(
  type: ParquetLogType,
  options?: QueryOptions
): string[] {
  const baseColumns = REQUIRED_COLUMNS[type] || [];

  // 常に必要な列: timestamp, domain
  const requiredBase = ["timestamp", "domain"];

  // オプションに応じて追加の列を含める
  const extraColumns: string[] = [];

  if (options?.domain) {
    // ドメインフィルタがある場合はdomainが必要
    if (!extraColumns.includes("domain")) {
      extraColumns.push("domain");
    }
  }

  // 重複を除去
  const allColumns = [...new Set([...requiredBase, ...baseColumns, ...extraColumns])];
  return allColumns;
}

export class QueryEngine {
  queryReports(
    cspViolations: Record<string, unknown>[],
    networkRequests: Record<string, unknown>[],
    index: DynamicIndex,
    options: QueryOptions = {}
  ): PaginatedResult<CSPReport> {
    // レコードを変換
    const violations = cspViolations.map((r) =>
      parquetRecordToCspViolation(r)
    );
    const requests = networkRequests.map((r) =>
      parquetRecordToNetworkRequest(r)
    );

    // 結合してソート
    let combined: CSPReport[] = [...violations, ...requests];

    // ドメインフィルタ
    if (options.domain) {
      combined = combined.filter((r) => r.domain === options.domain);
    }

    // 時間範囲フィルタ
    if (options.since) {
      const sinceTime = new Date(options.since).getTime();
      combined = combined.filter(
        (r) => new Date(r.timestamp).getTime() >= sinceTime
      );
    }
    if (options.until) {
      const untilTime = new Date(options.until).getTime();
      combined = combined.filter(
        (r) => new Date(r.timestamp).getTime() <= untilTime
      );
    }

    // 日時でソート（降順）
    combined.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // ページング
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    const total = combined.length;
    const data = combined.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  queryViolations(
    cspViolations: Record<string, unknown>[],
    index: DynamicIndex,
    options: QueryOptions = {}
  ): PaginatedResult<CSPViolation> {
    const violations = cspViolations.map((r) =>
      parquetRecordToCspViolation(r)
    );

    let filtered = violations;

    // ドメインフィルタ
    if (options.domain) {
      filtered = filtered.filter((v) => v.domain === options.domain);
    }

    // 時間範囲フィルタ
    if (options.since) {
      const sinceTime = new Date(options.since).getTime();
      filtered = filtered.filter(
        (v) => new Date(v.timestamp).getTime() >= sinceTime
      );
    }
    if (options.until) {
      const untilTime = new Date(options.until).getTime();
      filtered = filtered.filter(
        (v) => new Date(v.timestamp).getTime() <= untilTime
      );
    }

    // ソート（降順）
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // ページング
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  queryNetworkRequests(
    networkRequests: Record<string, unknown>[],
    index: DynamicIndex,
    options: QueryOptions = {}
  ): PaginatedResult<NetworkRequest> {
    const requests = networkRequests.map((r) =>
      parquetRecordToNetworkRequest(r)
    );

    let filtered = requests;

    // ドメインフィルタ
    if (options.domain) {
      filtered = filtered.filter((r) => r.domain === options.domain);
    }

    // 時間範囲フィルタ
    if (options.since) {
      const sinceTime = new Date(options.since).getTime();
      filtered = filtered.filter(
        (r) => new Date(r.timestamp).getTime() >= sinceTime
      );
    }
    if (options.until) {
      const untilTime = new Date(options.until).getTime();
      filtered = filtered.filter(
        (r) => new Date(r.timestamp).getTime() <= untilTime
      );
    }

    // ソート（降順）
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // ページング
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  queryEvents(
    events: Record<string, unknown>[],
    index: DynamicIndex,
    options: QueryOptions = {}
  ): PaginatedResult<ParquetEvent> {
    const eventRecords = events.map((r) => parquetRecordToEvent(r));

    let filtered = eventRecords;

    // タイプフィルタ
    if (options.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }

    // ドメインフィルタ
    if (options.domain) {
      filtered = filtered.filter((e) => e.domain === options.domain);
    }

    // 時間範囲フィルタ
    if (options.since) {
      const sinceTime = typeof options.since === "string"
        ? new Date(options.since).getTime()
        : options.since;
      filtered = filtered.filter((e) => e.timestamp >= sinceTime);
    }
    if (options.until) {
      const untilTime = typeof options.until === "string"
        ? new Date(options.until).getTime()
        : options.until;
      filtered = filtered.filter((e) => e.timestamp <= untilTime);
    }

    // ソート（降順）
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // ページング
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  getUniqueDomains(
    cspViolations: Record<string, unknown>[],
    networkRequests: Record<string, unknown>[]
  ): string[] {
    const domains = new Set<string>();

    cspViolations.forEach((v) => {
      domains.add((v as any).domain as string);
    });

    networkRequests.forEach((r) => {
      domains.add((r as any).domain as string);
    });

    return Array.from(domains).sort();
  }
}
