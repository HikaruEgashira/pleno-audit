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

type Tail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;

function bindState<
  Args extends unknown[],
  Result,
  Fn extends (state: ReturnType<typeof createBackgroundServiceState>, ...args: Args) => Result
>(state: ReturnType<typeof createBackgroundServiceState>, fn: Fn) {
  return (...args: Tail<Parameters<Fn>>): ReturnType<Fn> => fn(state, ...args);
}

export function createBackgroundServices(serviceLogger: Logger) {
  const state = createBackgroundServiceState(serviceLogger);

  return {
    api: {
      ensureApiClient: bindState(state, ensureApiClient),
      initializeApiClientWithMigration: (
        checkMigrationNeeded: Parameters<typeof initializeApiClientWithMigration>[1],
        migrateToDatabase: Parameters<typeof initializeApiClientWithMigration>[2]
      ) => initializeApiClientWithMigration(state, checkMigrationNeeded, migrateToDatabase),
      clearReportsIfInitialized: async () => {
        if (!state.apiClient) {
          return;
        }
        await state.apiClient.clearReports();
      },
    },
    sync: {
      ensureSyncManager: bindState(state, ensureSyncManager),
      initializeSyncManagerWithAutoStart: () => initializeSyncManagerWithAutoStart(state),
      getSyncConfig: bindState(state, getSyncConfig),
      setSyncConfig: bindState(state, setSyncConfig),
      triggerSync: bindState(state, triggerSync),
    },
    events: {
      getOrInitParquetStore: bindState(state, getOrInitParquetStore),
      addEvent: bindState(state, addEvent),
    },
    alerts: {
      getAlertManager: bindState(state, getAlertManager),
      getPolicyManager: bindState(state, getPolicyManager),
      checkDomainPolicy: bindState(state, checkDomainPolicy),
      checkAIServicePolicy: bindState(state, checkAIServicePolicy),
      checkDataTransferPolicy: bindState(state, checkDataTransferPolicy),
      registerNotificationClickHandler,
    },
    storage: {
      queueStorageOperation: bindState(state, queueStorageOperation),
      initStorage,
      saveStorage,
      updateService: (
        domain: string,
        update: Parameters<typeof updateService>[2]
      ) =>
        updateService(state, domain, update, (newDomain) =>
          checkDomainPolicy(state, newDomain)
        ),
      addCookieToService: bindState(state, addCookieToService),
    },
    analysis: {
      handlePageAnalysis: bindState(state, handlePageAnalysis),
    },
    config: {
      getDetectionConfig,
      setDetectionConfig,
      getNotificationConfig,
      setNotificationConfig,
      getDataRetentionConfig,
      setDataRetentionConfig: bindState(state, setDataRetentionConfig),
      cleanupOldData: bindState(state, cleanupOldData),
      getBlockingConfig,
      setBlockingConfig: bindState(state, setBlockingConfig),
      getConnectionConfig: bindState(state, getConnectionConfig),
      setConnectionConfig: bindState(state, setConnectionConfig),
    },
    utils: {
      extractDomainFromUrl,
    },
  };
}
