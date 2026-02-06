import type { CapturedAIPrompt } from "@pleno-audit/detectors";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
} from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import {
  startCookieMonitor,
  onCookieChange,
  checkMigrationNeeded,
  migrateToDatabase,
  getSSOManager,
  ensureOffscreenDocument,
  getStorage,
  setStorage,
  clearAIPrompts,
  clearAllStorage,
  registerExtensionMonitorListener,
  createLogger,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createDoHMonitor,
  registerDoHMonitorListener,
  DEFAULT_DOH_MONITOR_CONFIG,
  getEnterpriseManager,
} from "@pleno-audit/extension-runtime";

const logger = createLogger("background");
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
} from "@pleno-audit/storage";
import { createAlarmHandlers as createAlarmHandlersModule } from "../lib/background/alarm-handlers";
import { createAIPromptMonitorService } from "../lib/background/ai-prompt-monitor-service";
import { createCSPReportingService } from "../lib/background/csp-reporting-service";
import {
  createBackgroundServices,
  type NewEvent,
  type PageAnalysis,
} from "../lib/background/background-services";
import {
  createRuntimeMessageHandlers as createRuntimeMessageHandlersModule,
  runAsyncMessageHandler as runAsyncMessageHandlerModule,
  type RuntimeHandlerDependencies,
} from "../lib/background/runtime-handlers";
import { initializeBackgroundServices } from "../lib/background/background-initializer";
import { registerRecurringAlarms, registerAlarmHandlers } from "../lib/background/alarm-scheduler";
import { registerRuntimeMessageRouter } from "../lib/background/runtime-message-router";
import { createRuntimeHandlerDependencies as createRuntimeHandlerDependenciesModule } from "../lib/background/runtime-handler-deps";
import { createDebugBridgeHandler } from "../lib/background/debug-bridge-handler";
import { createExtensionNetworkService } from "../lib/background/extension-network-service";
import { createExtensionNetworkAdapter } from "../lib/background/extension-network-adapter";
import { createDoHMonitorManager } from "../lib/background/doh-monitor-manager";
import { createDomainRiskService } from "../lib/background/domain-risk-service";
import {
  createSecurityEventHandlers,
  type ClipboardHijackData,
  type CookieAccessData,
  type DOMScrapingData,
  type DataExfiltrationData,
  type CredentialTheftData,
  type SupplyChainRiskData,
  type SuspiciousDownloadData,
  type TrackingBeaconData,
  type XSSDetectedData,
} from "../lib/background/security-event-handlers";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

const backgroundServices = createBackgroundServices(logger);
const {
  ensureApiClient,
  ensureSyncManager,
  initializeApiClientWithMigration,
  initializeSyncManagerWithAutoStart,
  getOrInitParquetStore,
  addEvent,
  getAlertManager,
  checkAIServicePolicy,
  checkDataTransferPolicy,
  registerNotificationClickHandler,
  queueStorageOperation,
  initStorage,
  saveStorage,
  getDetectionConfig,
  setDetectionConfig,
  getNotificationConfig,
  setNotificationConfig,
  updateService,
  addCookieToService,
  handlePageAnalysis,
  extractDomainFromUrl,
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
  clearApiClientReportsIfInitialized,
} = backgroundServices;

registerNotificationClickHandler();

const doHMonitorManager = createDoHMonitorManager({
  logger,
  defaultConfig: DEFAULT_DOH_MONITOR_CONFIG,
  createDoHMonitor,
  getStorage,
  setStorage: async (data) => setStorage(data),
});

const extensionNetworkService = createExtensionNetworkService({
  logger,
  getStorage,
  setStorage,
  getOrInitParquetStore,
  addEvent: (event) => addEvent(event as NewEvent),
  getAlertManager,
  getRuntimeId: () => chrome.runtime.id,
});

const extensionNetwork = createExtensionNetworkAdapter(extensionNetworkService);

/**
 * DNRマッチルールを定期チェック
 * Chrome DNR APIのレート制限（10分間に最大20回）に対応するため、
 * 36秒間隔の別アラームで実行する
 *
 * 注意: checkDNRMatches()内でglobalCallbacksが呼ばれ、
 * onRequestコールバック経由でバッファ追加とイベント追加が自動的に行われる
 */
async function checkDNRMatchesHandler() {
  await extensionNetwork.checkDNRMatchesHandler();
}
async function analyzeExtensionRisks(): Promise<void> {
  await extensionNetwork.analyzeExtensionRisks();
}

const securityEventHandlers = createSecurityEventHandlers({
  addEvent: (event) => addEvent(event as NewEvent),
  getAlertManager,
  extractDomainFromUrl,
  checkDataTransferPolicy,
  logger,
});

const cspReportingService = createCSPReportingService({
  logger,
  ensureApiClient,
  initStorage,
  saveStorage: async (data) => saveStorage(data),
  addEvent: async (event) => addEvent(event as NewEvent),
  devReportEndpoint: DEV_REPORT_ENDPOINT,
});

const aiPromptMonitorService = createAIPromptMonitorService({
  defaultDetectionConfig: DEFAULT_DETECTION_CONFIG,
  getStorage,
  setStorage,
  clearAIPrompts,
  queueStorageOperation,
  addEvent: async (event) => addEvent(event as NewEvent),
  updateService,
  checkAIServicePolicy,
  getAlertManager,
});

const domainRiskService = createDomainRiskService({
  logger,
  getStorage,
  setStorage: async (data) => setStorage(data),
  updateService,
  addEvent: async (event) => addEvent(event as NewEvent),
  getOrInitParquetStore,
  getAlertManager,
});

async function clearAllData(): Promise<{ success: boolean }> {
  try {
    logger.info("Clearing all data...");

    // 1. Clear report queue
    cspReportingService.clearReportQueue();

    // 2. Clear API client reports
    await clearApiClientReportsIfInitialized();

    // 3. Clear all IndexedDB databases via offscreen document
    try {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        type: "CLEAR_ALL_INDEXEDDB",
        id: crypto.randomUUID(),
      });
    } catch (error) {
      logger.warn("Error clearing IndexedDB:", error);
      // Continue even if IndexedDB clear fails
    }

    // 4. Clear chrome.storage.local and reset to defaults (preserve theme)
    await clearAllStorage({ preserveTheme: true });

    logger.info("All data cleared successfully");
    return { success: true };
  } catch (error) {
    logger.error("Error clearing all data:", error);
    return { success: false };
  }
}

// Main world script is now registered statically via manifest.json content_scripts
// Dynamic registration removed to avoid caching issues

const handleDebugBridgeForward = createDebugBridgeHandler({
  getOrInitParquetStore,
  getDoHMonitorConfig: doHMonitorManager.getDoHMonitorConfig,
  setDoHMonitorConfig: doHMonitorManager.setDoHMonitorConfig,
  getDoHRequests: doHMonitorManager.getDoHRequests,
});

function initializeDebugBridge(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  void import("../lib/debug-bridge.js").then(({ initDebugBridge }) => {
    initDebugBridge();
  });
}

async function initializeEventStore(): Promise<void> {
  await getOrInitParquetStore();
  logger.info("EventStore initialized");
}

async function initializeEnterpriseManagedFlow(): Promise<void> {
  const enterpriseManager = await getEnterpriseManager();
  const status = enterpriseManager.getStatus();

  if (!status.isManaged) {
    return;
  }

  logger.info("Enterprise managed mode detected", {
    ssoRequired: status.ssoRequired,
    settingsLocked: status.settingsLocked,
  });

  if (!status.ssoRequired) {
    return;
  }

  const ssoManager = await getSSOManager();
  const ssoStatus = await ssoManager.getStatus();

  if (ssoStatus.isAuthenticated) {
    return;
  }

  logger.info("SSO required but not authenticated - prompting user");

  await chrome.notifications.create("sso-required", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-128.png"),
    title: "認証が必要です",
    message: "組織のセキュリティポリシーにより、シングルサインオンでの認証が必要です。",
    priority: 2,
    requireInteraction: true,
  });

  const dashboardUrl = chrome.runtime.getURL("dashboard.html#auth");
  await chrome.tabs.create({ url: dashboardUrl, active: true });
}

async function initializeCSPReporter(): Promise<void> {
  await cspReportingService.initializeReporter();
}

async function migrateLegacyEventsIfNeeded(): Promise<void> {
  const needsMigration = await checkEventsMigrationNeeded();
  if (!needsMigration) {
    return;
  }

  const store = await getOrInitParquetStore();
  const result = await migrateEventsToIndexedDB(store);
  logger.info(`Event migration: ${result.success ? "success" : "failed"}`, result);
}

const initExtensionMonitor = () => extensionNetwork.initExtensionMonitor();
const flushNetworkRequestBuffer = () => extensionNetwork.flushNetworkRequestBuffer();

const runtimeHandlerDependencies: RuntimeHandlerDependencies =
  createRuntimeHandlerDependenciesModule({
    logger,
    fallbacks: {
      cspConfig: DEFAULT_CSP_CONFIG,
      detectionConfig: DEFAULT_DETECTION_CONFIG,
      aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
      nrdConfig: DEFAULT_NRD_CONFIG,
      typosquatConfig: DEFAULT_TYPOSQUAT_CONFIG,
      networkMonitorConfig: DEFAULT_NETWORK_MONITOR_CONFIG,
      dataRetentionConfig: DEFAULT_DATA_RETENTION_CONFIG,
      blockingConfig: DEFAULT_BLOCKING_CONFIG,
      notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
      doHMonitorConfig: DEFAULT_DOH_MONITOR_CONFIG,
    },
    debugBridge: {
      handleDebugBridgeForward,
    },
    extensionNetwork: {
      getKnownExtensions: extensionNetwork.getKnownExtensions,
      getNetworkRequests: extensionNetwork.getNetworkRequests,
      getExtensionRequests: extensionNetwork.getExtensionRequests,
      getExtensionStats: extensionNetwork.getExtensionStats,
      getNetworkMonitorConfig: extensionNetwork.getNetworkMonitorConfig,
      setNetworkMonitorConfig: extensionNetwork.setNetworkMonitorConfig,
      getAllExtensionRisks: extensionNetwork.getAllExtensionRisks,
      getExtensionRiskAnalysis: extensionNetwork.getExtensionRiskAnalysis,
      analyzeExtensionRisks: extensionNetwork.analyzeExtensionRisks,
    },
    pageAnalysis: {
      handlePageAnalysis: async (payload) => handlePageAnalysis(payload as PageAnalysis),
    },
    cspReporting: {
      handleCSPViolation: (data, sender) =>
        cspReportingService.handleCSPViolation(data as Omit<CSPViolation, "type">, sender),
      handleNetworkRequest: (data, sender) =>
        cspReportingService.handleNetworkRequest(data as Omit<NetworkRequest, "type">, sender),
      getCSPReports: cspReportingService.getCSPReports,
      generateCSPPolicy: cspReportingService.generateCSPPolicy,
      generateCSPPolicyByDomain: cspReportingService.generateCSPPolicyByDomain,
      saveGeneratedCSPPolicy: cspReportingService.saveGeneratedCSPPolicy,
      getCSPConfig: cspReportingService.getCSPConfig,
      setCSPConfig: cspReportingService.setCSPConfig,
      clearCSPData: cspReportingService.clearCSPData,
    },
    securityEvents: {
      handleDataExfiltration: (data, sender) =>
        securityEventHandlers.handleDataExfiltration(data as DataExfiltrationData, sender),
      handleCredentialTheft: (data, sender) =>
        securityEventHandlers.handleCredentialTheft(data as CredentialTheftData, sender),
      handleSupplyChainRisk: (data, sender) =>
        securityEventHandlers.handleSupplyChainRisk(data as SupplyChainRiskData, sender),
      handleTrackingBeacon: (data, sender) =>
        securityEventHandlers.handleTrackingBeacon(data as TrackingBeaconData, sender),
      handleClipboardHijack: (data, sender) =>
        securityEventHandlers.handleClipboardHijack(data as ClipboardHijackData, sender),
      handleCookieAccess: (data, sender) =>
        securityEventHandlers.handleCookieAccess(data as CookieAccessData, sender),
      handleXSSDetected: (data, sender) =>
        securityEventHandlers.handleXSSDetected(data as XSSDetectedData, sender),
      handleDOMScraping: (data, sender) =>
        securityEventHandlers.handleDOMScraping(data as DOMScrapingData, sender),
      handleSuspiciousDownload: (data, sender) =>
        securityEventHandlers.handleSuspiciousDownload(data as SuspiciousDownloadData, sender),
    },
    connection: {
      getConnectionConfig,
      setConnectionConfig,
      getSyncConfig,
      setSyncConfig,
      triggerSync,
    },
    enterprise: {
      getSSOManager,
      getEnterpriseManager,
    },
    detectionConfig: {
      getDetectionConfig,
      setDetectionConfig,
    },
    aiPrompt: {
      handleAIPromptCaptured: (payload) =>
        aiPromptMonitorService.handleAIPromptCaptured(payload as CapturedAIPrompt),
      getAIPrompts: aiPromptMonitorService.getAIPrompts,
      getAIPromptsCount: aiPromptMonitorService.getAIPromptsCount,
      getAIMonitorConfig: aiPromptMonitorService.getAIMonitorConfig,
      setAIMonitorConfig: aiPromptMonitorService.setAIMonitorConfig,
      clearAIData: aiPromptMonitorService.clearAIData,
    },
    domainRisk: {
      handleNRDCheck: domainRiskService.handleNRDCheck,
      getNRDConfig: domainRiskService.getNRDConfig,
      setNRDConfig: domainRiskService.setNRDConfig,
      handleTyposquatCheck: domainRiskService.handleTyposquatCheck,
      getTyposquatConfig: domainRiskService.getTyposquatConfig,
      setTyposquatConfig: domainRiskService.setTyposquatConfig,
    },
    parquet: {
      getOrInitParquetStore,
    },
    dataRetention: {
      getDataRetentionConfig,
      setDataRetentionConfig,
      cleanupOldData,
    },
    blocking: {
      getBlockingConfig,
      setBlockingConfig,
    },
    notification: {
      getNotificationConfig,
      setNotificationConfig,
    },
    doH: {
      getDoHMonitorConfig: doHMonitorManager.getDoHMonitorConfig,
      setDoHMonitorConfig: doHMonitorManager.setDoHMonitorConfig,
      getDoHRequests: doHMonitorManager.getDoHRequests,
    },
    dataManagement: {
      clearAllData,
    },
    stats: {
      getStats: async () => {
        const client = await ensureApiClient();
        return client.getStats();
      },
    },
  });

export default defineBackground(() => {
  // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
  registerExtensionMonitorListener();
  registerDoHMonitorListener();
  // Main world script (ai-hooks.js) is registered statically via manifest.json content_scripts

  initializeBackgroundServices({
    logger,
    initializeDebugBridge,
    initializeEventStore,
    initializeApiClient: () => initializeApiClientWithMigration(checkMigrationNeeded, migrateToDatabase),
    initializeSyncManager: () => initializeSyncManagerWithAutoStart(),
    initializeEnterpriseManagedFlow,
    initializeCSPReporter,
    migrateLegacyEventsIfNeeded,
    initExtensionMonitor,
  });
  registerRecurringAlarms();

  const alarmHandlers = createAlarmHandlersModule({
    logger,
    flushReportQueue: () => cspReportingService.flushReportQueue(),
    flushNetworkRequestBuffer,
    checkDNRMatchesHandler,
    analyzeExtensionRisks,
    cleanupOldData,
  });
  registerAlarmHandlers(alarmHandlers);

  const runtimeHandlers = createRuntimeMessageHandlersModule(
    runtimeHandlerDependencies,
  );
  registerRuntimeMessageRouter({
    logger,
    handlers: runtimeHandlers,
    runAsyncMessageHandler: runAsyncMessageHandlerModule,
  });

  doHMonitorManager.startDoHMonitor();

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");
    addCookieToService(domain, cookie).catch((err) => logger.debug("Add cookie to service failed:", err));
    addEvent({
      type: "cookie_set",
      domain,
      timestamp: cookie.detectedAt,
      details: {
        name: cookie.name,
        isSession: cookie.isSession,
      },
    }).catch((err) => logger.debug("Add cookie event failed:", err));
  });
});
