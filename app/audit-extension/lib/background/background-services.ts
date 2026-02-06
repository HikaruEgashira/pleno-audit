import type { Logger } from "@pleno-audit/extension-runtime";
import { createBackgroundServiceState } from "./background-services/state";
import {
  ensureApiClient,
  ensureSyncManager,
  initializeApiClientWithMigration,
  initializeSyncManagerWithAutoStart,
} from "./background-services/client";
import { addEvent, getOrInitParquetStore } from "./background-services/events";
import {
  checkAIServicePolicy,
  checkDataTransferPolicy,
  checkDomainPolicy,
  getAlertManager,
  getPolicyManager,
  registerNotificationClickHandler,
} from "./background-services/alerts";
import {
  initStorage,
  saveStorage,
  queueStorageOperation,
  updateService,
  addCookieToService,
} from "./background-services/storage";
import {
  getDetectionConfig,
  setDetectionConfig,
  getNotificationConfig,
  setNotificationConfig,
  getDataRetentionConfig,
  setDataRetentionConfig,
  cleanupOldData,
  getBlockingConfig,
  setBlockingConfig,
  getConnectionConfig,
  setConnectionConfig,
  getSyncConfig,
  setSyncConfig,
  triggerSync,
} from "./background-services/config";
import { handlePageAnalysis } from "./background-services/analysis";
import { extractDomainFromUrl } from "./background-services/utils";

export type { NewEvent, PageAnalysis } from "./background-services/types";

export function createBackgroundServices(serviceLogger: Logger) {
  const state = createBackgroundServiceState(serviceLogger);

  return {
    ensureApiClient: () => ensureApiClient(state),
    ensureSyncManager: () => ensureSyncManager(state),
    getOrInitParquetStore: () => getOrInitParquetStore(state),
    addEvent: (event: Parameters<typeof addEvent>[1]) => addEvent(state, event),
    getAlertManager: () => getAlertManager(state),
    getPolicyManager: () => getPolicyManager(state),
    checkDomainPolicy: (domain: string) => checkDomainPolicy(state, domain),
    checkAIServicePolicy: (params: Parameters<typeof checkAIServicePolicy>[1]) =>
      checkAIServicePolicy(state, params),
    checkDataTransferPolicy: (params: Parameters<typeof checkDataTransferPolicy>[1]) =>
      checkDataTransferPolicy(state, params),
    registerNotificationClickHandler,
    queueStorageOperation: <T>(operation: () => Promise<T>) => queueStorageOperation(state, operation),
    initStorage,
    saveStorage,
    getDetectionConfig,
    setDetectionConfig,
    getNotificationConfig,
    setNotificationConfig,
    updateService: (domain: string, update: Parameters<typeof updateService>[2]) =>
      updateService(state, domain, update, (newDomain) => checkDomainPolicy(state, newDomain)),
    addCookieToService: (domain: string, cookie: Parameters<typeof addCookieToService>[2]) =>
      addCookieToService(state, domain, cookie),
    handlePageAnalysis: (analysis: Parameters<typeof handlePageAnalysis>[1]) =>
      handlePageAnalysis(state, analysis),
    extractDomainFromUrl,
    getDataRetentionConfig,
    setDataRetentionConfig: (newConfig: Parameters<typeof setDataRetentionConfig>[1]) =>
      setDataRetentionConfig(state, newConfig),
    cleanupOldData: () => cleanupOldData(state),
    getBlockingConfig,
    setBlockingConfig: (newConfig: Parameters<typeof setBlockingConfig>[1]) =>
      setBlockingConfig(state, newConfig),
    getConnectionConfig: () => getConnectionConfig(state),
    setConnectionConfig: (mode: Parameters<typeof setConnectionConfig>[1], endpoint?: string) =>
      setConnectionConfig(state, mode, endpoint),
    getSyncConfig: () => getSyncConfig(state),
    setSyncConfig: (enabled: Parameters<typeof setSyncConfig>[1], endpoint?: string) =>
      setSyncConfig(state, enabled, endpoint),
    triggerSync: () => triggerSync(state),
    clearApiClientReportsIfInitialized: async () => {
      if (!state.apiClient) {
        return;
      }
      await state.apiClient.clearReports();
    },
    initializeApiClientWithMigration: (
      checkMigrationNeeded: Parameters<typeof initializeApiClientWithMigration>[1],
      migrateToDatabase: Parameters<typeof initializeApiClientWithMigration>[2]
    ) => initializeApiClientWithMigration(state, checkMigrationNeeded, migrateToDatabase),
    initializeSyncManagerWithAutoStart: () => initializeSyncManagerWithAutoStart(state),
  };
}
