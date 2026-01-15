import type { ParquetLogType } from "./types";

export interface ParquetFileStats {
  key: string;
  type: ParquetLogType;
  date: string;
  recordCount: number;
  sizeBytes: number;
  // 列統計（min/max）
  columnStats: Record<string, ColumnStats>;
  createdAt: number;
}

export interface ColumnStats {
  minValue?: string | number | bigint;
  maxValue?: string | number | bigint;
  nullCount: number;
  distinctCount?: number;
}

export interface QueryPredicate {
  column: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "between";
  value: unknown;
  value2?: unknown; // for "between"
}

export class StatsCache {
  private cache: Map<string, ParquetFileStats> = new Map();
  private ttlMs: number = 5 * 60 * 1000; // 5分

  set(stats: ParquetFileStats): void {
    this.cache.set(stats.key, stats);
  }

  get(key: string): ParquetFileStats | undefined {
    const stats = this.cache.get(key);
    if (!stats) return undefined;

    // TTLチェック
    if (Date.now() - stats.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return stats;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  // 述語プッシュダウン: 統計情報を使ってスキップ可能か判定
  canSkipWithPredicate(key: string, predicate: QueryPredicate): boolean {
    const stats = this.get(key);
    if (!stats) return false;

    const columnStats = stats.columnStats[predicate.column];
    if (!columnStats) return false;

    // min/maxが設定されていない場合はスキップ不可
    if (columnStats.minValue === undefined || columnStats.maxValue === undefined) {
      return false;
    }

    const { minValue, maxValue } = columnStats;
    const value = predicate.value;

    switch (predicate.operator) {
      case "eq":
        // 値がmin/maxの範囲外ならスキップ可能
        return this.compareValues(value, minValue) < 0 || this.compareValues(value, maxValue) > 0;

      case "ne":
        // 全ての値が同じ場合のみスキップ可能
        return this.compareValues(minValue, maxValue) === 0 &&
               this.compareValues(value, minValue) === 0;

      case "gt":
        // maxが値以下ならスキップ可能
        return this.compareValues(maxValue, value) <= 0;

      case "gte":
        // maxが値より小さいならスキップ可能
        return this.compareValues(maxValue, value) < 0;

      case "lt":
        // minが値以上ならスキップ可能
        return this.compareValues(minValue, value) >= 0;

      case "lte":
        // minが値より大きいならスキップ可能
        return this.compareValues(minValue, value) > 0;

      case "between":
        // min > value2 または max < value ならスキップ可能
        return this.compareValues(minValue, predicate.value2) > 0 ||
               this.compareValues(maxValue, value) < 0;

      case "in":
        // 全ての値が範囲外ならスキップ可能（簡易実装）
        if (!Array.isArray(value)) return false;
        return value.every(
          (v) => this.compareValues(v, minValue) < 0 || this.compareValues(v, maxValue) > 0
        );

      default:
        return false;
    }
  }

  private compareValues(a: unknown, b: unknown): number {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    if (typeof a === "bigint" && typeof b === "bigint") {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b);
    }
    // 型が異なる場合は文字列比較
    return String(a).localeCompare(String(b));
  }

  // レコードから統計情報を計算
  computeStats(
    key: string,
    type: ParquetLogType,
    date: string,
    records: Record<string, unknown>[],
    columns: string[]
  ): ParquetFileStats {
    const columnStats: Record<string, ColumnStats> = {};

    for (const column of columns) {
      let minValue: unknown = undefined;
      let maxValue: unknown = undefined;
      let nullCount = 0;
      const distinctValues = new Set<unknown>();

      for (const record of records) {
        const value = record[column];

        if (value === null || value === undefined) {
          nullCount++;
          continue;
        }

        distinctValues.add(value);

        if (minValue === undefined || this.compareValues(value, minValue) < 0) {
          minValue = value;
        }
        if (maxValue === undefined || this.compareValues(value, maxValue) > 0) {
          maxValue = value;
        }
      }

      columnStats[column] = {
        minValue: minValue as string | number | bigint | undefined,
        maxValue: maxValue as string | number | bigint | undefined,
        nullCount,
        distinctCount: distinctValues.size,
      };
    }

    const totalSize = new TextEncoder().encode(JSON.stringify(records)).length;

    const stats: ParquetFileStats = {
      key,
      type,
      date,
      recordCount: records.length,
      sizeBytes: totalSize,
      columnStats,
      createdAt: Date.now(),
    };

    this.set(stats);
    return stats;
  }

  // 統計情報のバッチ更新
  updateBatch(statsArray: ParquetFileStats[]): void {
    for (const stats of statsArray) {
      this.set(stats);
    }
  }

  // タイプ別の統計サマリーを取得
  getSummaryByType(type: ParquetLogType): {
    fileCount: number;
    totalRecords: number;
    totalSize: number;
    dateRange: { min: string | null; max: string | null };
  } {
    let fileCount = 0;
    let totalRecords = 0;
    let totalSize = 0;
    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (const [, stats] of this.cache) {
      if (stats.type !== type) continue;

      fileCount++;
      totalRecords += stats.recordCount;
      totalSize += stats.sizeBytes;

      if (!minDate || stats.date < minDate) {
        minDate = stats.date;
      }
      if (!maxDate || stats.date > maxDate) {
        maxDate = stats.date;
      }
    }

    return {
      fileCount,
      totalRecords,
      totalSize,
      dateRange: { min: minDate, max: maxDate },
    };
  }

  clear(): void {
    this.cache.clear();
  }

  setTTL(ttlMs: number): void {
    this.ttlMs = ttlMs;
  }

  size(): number {
    return this.cache.size;
  }
}
