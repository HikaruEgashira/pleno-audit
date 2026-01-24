import { mkdir, writeFile, readFile, readdir, unlink } from "fs/promises";
import { join } from "path";
import type { ParquetFileRecord } from "@pleno-audit/parquet-storage";

/**
 * Node.js環境向けのファイルシステムベースのストレージアダプター。
 * ParquetFileRecordをメタデータ（JSON）とデータ（バイナリ）に分離して保存する。
 */
export class FileSystemAdapter {
  private metadataDir: string;
  private dataDir: string;

  /**
   * FileSystemAdapterのインスタンスを作成する。
   * @param baseDir - ストレージのベースディレクトリパス
   */
  constructor(baseDir: string) {
    this.metadataDir = join(baseDir, "metadata");
    this.dataDir = join(baseDir, "data");
  }

  /**
   * ストレージディレクトリを初期化する。
   * metadata/とdata/のサブディレクトリを作成する。
   */
  async init(): Promise<void> {
    await mkdir(this.metadataDir, { recursive: true });
    await mkdir(this.dataDir, { recursive: true });
  }

  /**
   * ParquetFileRecordをファイルシステムに保存する。
   * @param record - 保存するレコード
   */
  async save(record: ParquetFileRecord): Promise<void> {
    const metadataPath = join(this.metadataDir, `${record.key}.json`);
    const metadata = {
      key: record.key,
      type: record.type,
      date: record.date,
      recordCount: record.recordCount,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
      lastModified: record.lastModified,
    };
    await writeFile(metadataPath, JSON.stringify(metadata));

    const dataPath = join(this.dataDir, `${record.key}.parquet`);
    await writeFile(dataPath, record.data);
  }

  /**
   * 指定されたキーのレコードを読み込む。
   * @param key - 読み込むレコードのキー
   * @returns レコード、存在しない場合はundefined
   */
  async load(key: string): Promise<ParquetFileRecord | undefined> {
    try {
      const metadataPath = join(this.metadataDir, `${key}.json`);
      const dataPath = join(this.dataDir, `${key}.parquet`);

      const metadataContent = await readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent);

      const data = await readFile(dataPath);

      return {
        ...metadata,
        data: new Uint8Array(data),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * 指定されたタイプのレコードを全て取得する。
   * @param type - フィルターするレコードタイプ
   * @returns 該当するレコードの配列
   */
  async listByType(type: string): Promise<ParquetFileRecord[]> {
    try {
      const files = await readdir(this.metadataDir);
      const records: ParquetFileRecord[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const key = file.replace(".json", "");
          const record = await this.load(key);
          if (record && record.type === type) {
            records.push(record);
          }
        }
      }

      return records;
    } catch {
      return [];
    }
  }

  /**
   * 指定されたタイプと日付範囲のレコードを取得する。
   * @param type - フィルターするレコードタイプ
   * @param startDate - 開始日（YYYY-MM-DD形式）
   * @param endDate - 終了日（YYYY-MM-DD形式）
   * @returns 該当するレコードの配列
   */
  async listByDateRange(
    type: string,
    startDate: string,
    endDate: string
  ): Promise<ParquetFileRecord[]> {
    const allRecords = await this.listByType(type);
    return allRecords.filter((r) => r.date >= startDate && r.date <= endDate);
  }

  /**
   * 指定されたキーのレコードを削除する。
   * @param key - 削除するレコードのキー
   */
  async delete(key: string): Promise<void> {
    const metadataPath = join(this.metadataDir, `${key}.json`);
    const dataPath = join(this.dataDir, `${key}.parquet`);

    try {
      await unlink(metadataPath);
    } catch {
      // ファイルが存在しない場合は無視
    }

    try {
      await unlink(dataPath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * 指定された日付より前のレコードを削除する。
   * @param type - フィルターするレコードタイプ
   * @param beforeDate - この日付より前のレコードを削除（YYYY-MM-DD形式）
   * @returns 削除されたレコード数
   */
  async deleteBeforeDate(type: string, beforeDate: string): Promise<number> {
    const records = await this.listByType(type);
    const toDelete = records.filter((r) => r.date < beforeDate);

    for (const record of toDelete) {
      await this.delete(record.key);
    }

    return toDelete.length;
  }

  /**
   * 全てのレコードを削除する。
   */
  async clear(): Promise<void> {
    try {
      const files = await readdir(this.metadataDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const key = file.replace(".json", "");
          await this.delete(key);
        }
      }
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }
}
