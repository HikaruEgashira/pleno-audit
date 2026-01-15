import type { ParquetLogType, ParquetFileRecord } from "./types";
import { getDateString } from "./schema";

export interface PartitionInfo {
  type: ParquetLogType;
  date: string;
  key: string;
  recordCount: number;
  sizeBytes: number;
  lastModified: number;
}

export interface PartitionStats {
  totalPartitions: number;
  totalRecords: number;
  totalSizeBytes: number;
  oldestDate: string | null;
  newestDate: string | null;
  byType: Record<ParquetLogType, number>;
}

export interface CompactionResult {
  compactedPartitions: number;
  reducedSizeBytes: number;
  timestamp: number;
}

export class PartitionManager {
  private partitions: Map<string, PartitionInfo> = new Map();

  updatePartitionInfo(record: ParquetFileRecord): void {
    const info: PartitionInfo = {
      type: record.type,
      date: record.date,
      key: record.key,
      recordCount: record.recordCount,
      sizeBytes: record.sizeBytes,
      lastModified: record.lastModified,
    };
    this.partitions.set(record.key, info);
  }

  removePartition(key: string): void {
    this.partitions.delete(key);
  }

  getPartitionsForDateRange(
    type: ParquetLogType,
    startDate: string,
    endDate: string
  ): PartitionInfo[] {
    const result: PartitionInfo[] = [];

    for (const [, info] of this.partitions) {
      if (info.type !== type) continue;
      if (info.date < startDate || info.date > endDate) continue;
      result.push(info);
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  // パーティションプルーニング: 日付範囲外のパーティションをスキップ
  shouldSkipPartition(
    partitionDate: string,
    startDate: string,
    endDate: string
  ): boolean {
    return partitionDate < startDate || partitionDate > endDate;
  }

  getStats(): PartitionStats {
    const byType: Record<ParquetLogType, number> = {
      "csp-violations": 0,
      "network-requests": 0,
      events: 0,
      "ai-prompts": 0,
    };

    let totalRecords = 0;
    let totalSizeBytes = 0;
    let oldestDate: string | null = null;
    let newestDate: string | null = null;

    for (const [, info] of this.partitions) {
      byType[info.type]++;
      totalRecords += info.recordCount;
      totalSizeBytes += info.sizeBytes;

      if (!oldestDate || info.date < oldestDate) {
        oldestDate = info.date;
      }
      if (!newestDate || info.date > newestDate) {
        newestDate = info.date;
      }
    }

    return {
      totalPartitions: this.partitions.size,
      totalRecords,
      totalSizeBytes,
      oldestDate,
      newestDate,
      byType,
    };
  }

  // 小さなパーティションを特定（コンパクション候補）
  getSmallPartitions(
    type: ParquetLogType,
    maxSizeBytes: number = 100 * 1024 // 100KB
  ): PartitionInfo[] {
    const result: PartitionInfo[] = [];

    for (const [, info] of this.partitions) {
      if (info.type !== type) continue;
      if (info.sizeBytes < maxSizeBytes) {
        result.push(info);
      }
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  // 古いパーティションを特定（保持ポリシー適用候補）
  getPartitionsOlderThan(days: number): PartitionInfo[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = getDateString(cutoffDate);

    const result: PartitionInfo[] = [];

    for (const [, info] of this.partitions) {
      if (info.date < cutoff) {
        result.push(info);
      }
    }

    return result;
  }

  // 月ごとのパーティション統計
  getMonthlyStats(): Map<string, PartitionStats> {
    const monthlyMap = new Map<string, PartitionStats>();

    for (const [, info] of this.partitions) {
      const month = info.date.substring(0, 7); // YYYY-MM

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          totalPartitions: 0,
          totalRecords: 0,
          totalSizeBytes: 0,
          oldestDate: null,
          newestDate: null,
          byType: {
            "csp-violations": 0,
            "network-requests": 0,
            events: 0,
            "ai-prompts": 0,
          },
        });
      }

      const stats = monthlyMap.get(month)!;
      stats.totalPartitions++;
      stats.totalRecords += info.recordCount;
      stats.totalSizeBytes += info.sizeBytes;
      stats.byType[info.type]++;

      if (!stats.oldestDate || info.date < stats.oldestDate) {
        stats.oldestDate = info.date;
      }
      if (!stats.newestDate || info.date > stats.newestDate) {
        stats.newestDate = info.date;
      }
    }

    return monthlyMap;
  }

  clear(): void {
    this.partitions.clear();
  }
}
