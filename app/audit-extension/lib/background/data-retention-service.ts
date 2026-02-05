import {
  DEFAULT_DATA_RETENTION_CONFIG,
  type DataRetentionConfig,
} from "@pleno-audit/extension-runtime";

interface LoggerLike {
  info: (message: string) => void;
  error: (...args: unknown[]) => void;
}

interface DataRetentionServiceDeps {
  logger: LoggerLike;
  getStorage: () => Promise<{ dataRetentionConfig?: DataRetentionConfig; aiPrompts?: { timestamp: number }[] }>;
  setStorage: (data: { dataRetentionConfig?: DataRetentionConfig; aiPrompts?: { timestamp: number }[] }) => Promise<void>;
  ensureApiClient: () => Promise<{ deleteOldReports: (cutoff: string) => Promise<number> }>;
  getOrInitParquetStore: () => Promise<{ deleteOldReports: (cutoffDate: string) => Promise<void> }>;
}

export function createDataRetentionService(deps: DataRetentionServiceDeps) {
  async function getDataRetentionConfig(): Promise<DataRetentionConfig> {
    const storage = await deps.getStorage();
    return storage.dataRetentionConfig || DEFAULT_DATA_RETENTION_CONFIG;
  }

  async function setDataRetentionConfig(newConfig: DataRetentionConfig): Promise<{ success: boolean }> {
    try {
      await deps.setStorage({ dataRetentionConfig: newConfig });
      return { success: true };
    } catch (error) {
      deps.logger.error("Error setting data retention config:", error);
      return { success: false };
    }
  }

  async function cleanupOldData(): Promise<{ deleted: number }> {
    try {
      const config = await getDataRetentionConfig();
      if (!config.autoCleanupEnabled || config.retentionDays === 0) {
        return { deleted: 0 };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
      const cutoffTimestamp = cutoffDate.toISOString();
      const cutoffMs = cutoffDate.getTime();

      const client = await deps.ensureApiClient();
      const deleted = await client.deleteOldReports(cutoffTimestamp);

      const store = await deps.getOrInitParquetStore();
      const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
      await store.deleteOldReports(cutoffDateStr);

      const storage = await deps.getStorage();
      const aiPrompts = storage.aiPrompts || [];
      const filteredPrompts = aiPrompts.filter((prompt) => prompt.timestamp >= cutoffMs);
      if (filteredPrompts.length < aiPrompts.length) {
        await deps.setStorage({ aiPrompts: filteredPrompts });
      }

      await deps.setStorage({
        dataRetentionConfig: {
          ...config,
          lastCleanupTimestamp: Date.now(),
        },
      });

      deps.logger.info(`Data cleanup completed. Deleted ${deleted} CSP reports.`);
      return { deleted };
    } catch (error) {
      deps.logger.error("Error during data cleanup:", error);
      return { deleted: 0 };
    }
  }

  return {
    getDataRetentionConfig,
    setDataRetentionConfig,
    cleanupOldData,
  };
}
