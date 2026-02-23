import { ParquetStore } from "@pleno-audit/parquet-storage";
import type {
  CSPReport,
  CSPViolation,
  NetworkRequest,
} from "@pleno-audit/csp";
import type {
  DatabaseAdapter,
  DatabaseStats,
  PaginatedResult,
  QueryOptions,
} from "./interface";
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("parquet-adapter");

export class ParquetAdapter implements DatabaseAdapter {
  private store: ParquetStore;

  constructor() {
    this.store = new ParquetStore();
  }

  async init(): Promise<void> {
    try {
      await this.store.init();
      logger.info("ParquetAdapter initialized");
    } catch (error) {
      logger.error("Failed to initialize ParquetAdapter", error);
      throw error;
    }
  }

  async insertReports(reports: CSPReport[]): Promise<void> {
    try {
      await this.store.insertReports(reports);
    } catch (error) {
      logger.error("Failed to insert reports", error);
      throw error;
    }
  }

  async getAllReports(): Promise<CSPReport[]> {
    try {
      const result = await this.store.getReports({
        limit: -1, // 全取得
      });
      return result.data;
    } catch (error) {
      logger.error("Failed to get all reports", error);
      throw error;
    }
  }

  async getAllViolations(): Promise<CSPViolation[]> {
    try {
      const result = await this.store.getViolations({
        limit: -1, // 全取得
      });
      return result.data;
    } catch (error) {
      logger.error("Failed to get all violations", error);
      throw error;
    }
  }

  async getAllNetworkRequests(): Promise<NetworkRequest[]> {
    try {
      const result = await this.store.getNetworkRequests({
        limit: -1, // 全取得
      });
      return result.data;
    } catch (error) {
      logger.error("Failed to get all network requests", error);
      throw error;
    }
  }

  async getReportsSince(timestamp: string): Promise<CSPReport[]> {
    try {
      const result = await this.store.getReports({
        since: timestamp,
        limit: -1,
      });
      return result.data;
    } catch (error) {
      logger.error("Failed to get reports since", error);
      throw error;
    }
  }

  async getReports(options?: QueryOptions): Promise<PaginatedResult<CSPReport>> {
    try {
      return await this.store.getReports(options);
    } catch (error) {
      logger.error("Failed to get reports", error);
      throw error;
    }
  }

  async getViolations(
    options?: QueryOptions
  ): Promise<PaginatedResult<CSPViolation>> {
    try {
      return await this.store.getViolations(options);
    } catch (error) {
      logger.error("Failed to get violations", error);
      throw error;
    }
  }

  async getNetworkRequests(
    options?: QueryOptions
  ): Promise<PaginatedResult<NetworkRequest>> {
    try {
      return await this.store.getNetworkRequests(options);
    } catch (error) {
      logger.error("Failed to get network requests", error);
      throw error;
    }
  }

  async getStats(): Promise<DatabaseStats> {
    try {
      return await this.store.getStats();
    } catch (error) {
      logger.error("Failed to get stats", error);
      throw error;
    }
  }

  async deleteOldReports(beforeTimestamp: string): Promise<number> {
    try {
      // タイムスタンプから日付に変換
      const date = new Date(beforeTimestamp).toISOString().split("T")[0];
      return await this.store.deleteOldReports(date);
    } catch (error) {
      logger.error("Failed to delete old reports", error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await this.store.clearAll();
      logger.info("All data cleared");
    } catch (error) {
      logger.error("Failed to clear all data", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.store.close();
    logger.debug("ParquetAdapter closed");
  }
}
