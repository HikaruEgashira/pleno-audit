import type { ParquetFileRecord } from "@pleno-audit/parquet-storage";

/**
 * ストレージアダプターのインターフェース。
 * FileSystemAdapter と S3StorageAdapter で共通のインターフェースを提供する。
 */
export interface StorageAdapter {
  init(): Promise<void>;
  save(record: ParquetFileRecord): Promise<void>;
  load(key: string): Promise<ParquetFileRecord | undefined>;
  listByType(type: string): Promise<ParquetFileRecord[]>;
  listByDateRange(type: string, startDate: string, endDate: string): Promise<ParquetFileRecord[]>;
  delete(key: string): Promise<void>;
  deleteBeforeDate(type: string, beforeDate: string): Promise<number>;
  clear(): Promise<void>;
}
