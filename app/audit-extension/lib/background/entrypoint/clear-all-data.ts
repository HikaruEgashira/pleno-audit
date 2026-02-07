import type { Logger } from "@pleno-audit/extension-runtime";

interface ClearAllDataParams {
  logger: Logger;
  clearReportQueue: () => void;
  clearReportsIfInitialized: () => Promise<void>;
  ensureOffscreenDocument: () => Promise<void>;
  clearAllStorage: (options: { preserveTheme: boolean }) => Promise<void>;
}

export function createClearAllData(params: ClearAllDataParams) {
  return async function clearAllData(): Promise<{ success: boolean }> {
    try {
      params.logger.info("Clearing all data...");

      params.clearReportQueue();
      await params.clearReportsIfInitialized();

      try {
        await params.ensureOffscreenDocument();
        await chrome.runtime.sendMessage({
          type: "CLEAR_ALL_INDEXEDDB",
          id: crypto.randomUUID(),
        });
      } catch (error) {
        params.logger.warn("Error clearing IndexedDB:", error);
      }

      await params.clearAllStorage({ preserveTheme: true });

      params.logger.info("All data cleared successfully");
      return { success: true };
    } catch (error) {
      params.logger.error("Error clearing all data:", error);
      return { success: false };
    }
  };
}
