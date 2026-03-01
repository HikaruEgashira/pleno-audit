import type { CapturedAIPrompt } from "@pleno-audit/detectors";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
} from "@pleno-audit/detectors";
import type { CSPViolation } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import {
  startCookieMonitor,
  onCookieChange,
  checkMigrationNeeded,
  migrateToDatabase,
  getSSOManager,
  ensureOffscreenDocument,
  markOffscreenReady,
  getStorage,
  setStorage,
  clearAIPrompts,
  clearAllStorage,
  registerNetworkMonitorListener,
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
  type DoHMonitor,
  type DoHMonitorConfig,
  type DoHRequestRecord,
} from "@pleno-audit/extension-runtime";

const logger = createLogger("background");
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
} from "@pleno-audit/storage";
import {
  createAlarmHandlers as createAlarmHandlersModule,
  createAIPromptMonitorService,
  createCSPReportingService,
  createBackgroundServices,
  type NewEvent,
  type PageAnalysis,
  createRuntimeMessageHandlers as createRuntimeMessageHandlersModule,
  runAsyncMessageHandler as runAsyncMessageHandlerModule,
  type RuntimeMessage,
  type RuntimeHandlerDependencies,
  createDebugBridgeHandler,
  createDomainRiskService,
  createNetworkSecurityInspector,
  createSecurityEventHandlers,
  type ClipboardHijackData,
  type CookieAccessData,
  type DOMScrapingData,
  type DataExfiltrationData,
  type NetworkInspectionRequest,
  type CredentialTheftData,
  type SupplyChainRiskData,
  type SuspiciousDownloadData,
  type TrackingBeaconData,
  type XSSDetectedData,
} from "@pleno-audit/background-services";
import { createExtensionNetworkService } from "@pleno-audit/extension-network-service";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

const backgroundServices = createBackgroundServices(logger);
const {
  api: backgroundApi,
  events: backgroundEvents,
  alerts: backgroundAlerts,
  storage: backgroundStorage,
  utils: backgroundUtils,
} = backgroundServices;

backgroundAlerts.registerNotificationClickHandler();

class DoHMonitorManager {
  private monitor: DoHMonitor | null = null;

  constructor(
    private readonly deps: {
      logger: ReturnType<typeof createLogger>;
      getStorage: typeof getStorage;
      setStorage: typeof setStorage;
    },
  ) {}

  async getConfig(): Promise<DoHMonitorConfig> {
    const storage = await this.deps.getStorage();
    return storage.doHMonitorConfig || DEFAULT_DOH_MONITOR_CONFIG;
  }

  async setConfig(config: Partial<DoHMonitorConfig>): Promise<{ success: boolean }> {
    const storage = await this.deps.getStorage();
    storage.doHMonitorConfig = {
      ...DEFAULT_DOH_MONITOR_CONFIG,
      ...storage.doHMonitorConfig,
      ...config,
    };
    await this.deps.setStorage(storage);

    if (this.monitor) {
      await this.monitor.updateConfig(storage.doHMonitorConfig);
    }

    return { success: true };
  }

  async getRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: DoHRequestRecord[]; total: number }> {
    const storage = await this.deps.getStorage();
    const allRequests = storage.doHRequests || [];
    const total = allRequests.length;

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const sorted = [...allRequests].sort((a, b) => b.timestamp - a.timestamp);
    const requests = sorted.slice(offset, offset + limit);

    return { requests, total };
  }

  async start(): Promise<void> {
    const storage = await this.deps.getStorage();
    const config = storage.doHMonitorConfig ?? DEFAULT_DOH_MONITOR_CONFIG;
    this.monitor = createDoHMonitor(config);
    this.monitor.start().catch((err) => this.deps.logger.error("Failed to start DoH monitor:", err));
    this.monitor.onRequest((record: DoHRequestRecord) => {
      void this.enqueueRequest(record);
    });
  }

  private requestQueue: Promise<void> = Promise.resolve();

  private enqueueRequest(record: DoHRequestRecord): Promise<void> {
    this.requestQueue = this.requestQueue.then(() => this.handleRequest(record));
    return this.requestQueue;
  }

  private async handleRequest(record: DoHRequestRecord): Promise<void> {
    try {
      const storage = await this.deps.getStorage();
      if (!storage.doHRequests) {
        storage.doHRequests = [];
      }
      storage.doHRequests.push(record);

      // Keep only recent requests
      const maxRequests = storage.doHMonitorConfig?.maxStoredRequests ?? 1000;
      if (storage.doHRequests.length > maxRequests) {
        storage.doHRequests = storage.doHRequests.slice(-maxRequests);
      }

      await this.deps.setStorage(storage);
      this.deps.logger.debug("DoH request stored:", record.domain);

      const config = storage.doHMonitorConfig ?? DEFAULT_DOH_MONITOR_CONFIG;
      if (config.action === "alert" || config.action === "block") {
        await chrome.notifications.create(`doh-${record.id}`, {
          type: "basic",
          iconUrl: "icon-128.png",
          title: "DoH Traffic Detected",
          message: `DNS over HTTPS request to ${record.domain} (${record.detectionMethod})`,
          priority: 0,
        });
      }
    } catch (error) {
      this.deps.logger.error("Failed to store DoH request:", error);
    }
  }
}

const extensionNetworkService = createExtensionNetworkService({
  logger,
  getStorage,
  setStorage,
  getOrInitParquetStore: backgroundEvents.getOrInitParquetStore,
  addEvent: (event) => backgroundEvents.addEvent(event as NewEvent),
  getAlertManager: backgroundAlerts.getAlertManager,
  getRuntimeId: () => chrome.runtime.id,
});

const doHMonitorManager = new DoHMonitorManager({ logger, getStorage, setStorage });

const securityEventHandlers = createSecurityEventHandlers({
  addEvent: (event) => backgroundEvents.addEvent(event as NewEvent),
  getAlertManager: backgroundAlerts.getAlertManager,
  extractDomainFromUrl: backgroundUtils.extractDomainFromUrl,
  checkDataTransferPolicy: backgroundAlerts.checkDataTransferPolicy,
  logger,
});

const networkSecurityInspector = createNetworkSecurityInspector({
  handleDataExfiltration: (data, sender) =>
    securityEventHandlers.handleDataExfiltration(data, sender),
  handleTrackingBeacon: (data, sender) =>
    securityEventHandlers.handleTrackingBeacon(data, sender),
  logger,
});

const cspReportingService = createCSPReportingService({
  logger,
  ensureApiClient: backgroundApi.ensureApiClient,
  initStorage: backgroundStorage.initStorage,
  saveStorage: async (data) => backgroundStorage.saveStorage(data),
  addEvent: async (event) => backgroundEvents.addEvent(event as NewEvent),
  devReportEndpoint: DEV_REPORT_ENDPOINT,
});

const aiPromptMonitorService = createAIPromptMonitorService({
  defaultDetectionConfig: DEFAULT_DETECTION_CONFIG,
  getStorage,
  setStorage,
  clearAIPrompts,
  queueStorageOperation: backgroundStorage.queueStorageOperation,
  addEvent: async (event) => backgroundEvents.addEvent(event as NewEvent),
  updateService: backgroundStorage.updateService,
  checkAIServicePolicy: backgroundAlerts.checkAIServicePolicy,
  getAlertManager: backgroundAlerts.getAlertManager,
});

const domainRiskService = createDomainRiskService({
  logger,
  getStorage,
  setStorage: async (data) => setStorage(data),
  updateService: backgroundStorage.updateService,
  addEvent: async (event) => backgroundEvents.addEvent(event as NewEvent),
  getOrInitParquetStore: backgroundEvents.getOrInitParquetStore,
  getAlertManager: backgroundAlerts.getAlertManager,
});

class OperationGuard<T> {
  private pending: Promise<T> | null = null;

  async run(operation: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;

    this.pending = operation();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }
}
type BackgroundRuntimeDependencies = {
  logger: ReturnType<typeof createLogger>;
  backgroundServices: typeof backgroundServices;
  extensionNetworkService: ReturnType<typeof createExtensionNetworkService>;
  cspReportingService: ReturnType<typeof createCSPReportingService>;
  aiPromptMonitorService: ReturnType<typeof createAIPromptMonitorService>;
  domainRiskService: ReturnType<typeof createDomainRiskService>;
  securityEventHandlers: ReturnType<typeof createSecurityEventHandlers>;
  networkSecurityInspector: ReturnType<typeof createNetworkSecurityInspector>;
  doHMonitorManager: DoHMonitorManager;
};

class BackgroundRuntime {
  private readonly clearAllDataGuard = new OperationGuard<{ success: boolean }>();
  private readonly handleDebugBridgeForward: ReturnType<typeof createDebugBridgeHandler>;

  constructor(private readonly deps: BackgroundRuntimeDependencies) {
    this.handleDebugBridgeForward = createDebugBridgeHandler({
      getOrInitParquetStore: deps.backgroundServices.events.getOrInitParquetStore,
      getDoHMonitorConfig: () => deps.doHMonitorManager.getConfig(),
      setDoHMonitorConfig: (config) => deps.doHMonitorManager.setConfig(config),
      getDoHRequests: (options) => deps.doHMonitorManager.getRequests(options),
    });
  }

  start(): void {
    const { doHMonitorManager } = this.deps;

    // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
    registerNetworkMonitorListener();
    registerDoHMonitorListener();

    this.initializeBackgroundServices();
    this.registerRecurringAlarms();
    this.registerAlarmListeners();
    this.registerRuntimeMessageHandlers();

    void doHMonitorManager.start();

    startCookieMonitor();
    onCookieChange((cookie, removed) => {
      if (removed) return;

      const domain = cookie.domain.replace(/^\./, "");
      this.deps.backgroundServices.storage
        .addCookieToService(domain, cookie)
        .catch((err) => this.deps.logger.debug("Add cookie to service failed:", err));
      this.deps.backgroundServices.events.addEvent({
        type: "cookie_set",
        domain,
        timestamp: cookie.detectedAt,
        details: {
          name: cookie.name,
          isSession: cookie.isSession,
        },
      }).catch((err) => this.deps.logger.debug("Add cookie event failed:", err));
    });

  }

  private async clearAllData(): Promise<{ success: boolean }> {
    const { logger, cspReportingService, backgroundServices, extensionNetworkService } = this.deps;

    return this.clearAllDataGuard.run(async () => {
      let monitorStopped = false;
      try {
        logger.info("Clearing all data...");
        let indexedDbCleared = true;

        // 1. Stop event producers before DB teardown to avoid closing-race transactions.
        await extensionNetworkService.stopExtensionMonitor();
        monitorStopped = true;
        await backgroundServices.events.closeParquetStore();

        // 2. Clear in-memory queue first.
        cspReportingService.clearReportQueue();

        // 3. Clear API client reports.
        await backgroundServices.api.clearReportsIfInitialized();

        // 4. Clear all IndexedDB databases via offscreen document.
        try {
          await ensureOffscreenDocument();
          await chrome.runtime.sendMessage({
            type: "CLEAR_ALL_INDEXEDDB",
            id: crypto.randomUUID(),
          });
        } catch (error) {
          indexedDbCleared = false;
          logger.error({
            event: "CLEAR_ALL_DATA_INDEXEDDB_CLEAR_FAILED",
            error,
          });
          // Continue even if IndexedDB clear fails.
        }

        // 5. Clear chrome.storage.local and reset to defaults (preserve theme).
        await clearAllStorage({ preserveTheme: true });

        if (indexedDbCleared) {
          logger.info("All data cleared successfully");
        } else {
          logger.warn({
            event: "CLEAR_ALL_DATA_PARTIAL_SUCCESS",
            data: {
              indexedDbCleared,
            },
          });
        }
        return { success: true };
      } catch (error) {
        logger.error("Error clearing all data:", error);
        return { success: false };
      } finally {
        if (monitorStopped) {
          await this.initExtensionMonitor().catch((error) => {
            logger.error("Extension monitor re-init failed after clear:", error);
          });
        }
      }
    });
  }

  private initializeDebugBridge(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const { extensionNetworkService } = this.deps;
    void import("@pleno-audit/debug-bridge").then(({ initDebugBridge }) => {
      initDebugBridge({
        getNetworkRequests: (options) => extensionNetworkService.getNetworkRequests(options),
        getNetworkMonitorConfig: () => extensionNetworkService.getNetworkMonitorConfig(),
        setNetworkMonitorConfig: (config) => extensionNetworkService.setNetworkMonitorConfig(config),
      });
    });
  }

  private async initializeEventStore(): Promise<void> {
    await this.deps.backgroundServices.events.getOrInitParquetStore();
    this.deps.logger.debug("EventStore initialized");
  }

  private async initializeEnterpriseManagedFlow(): Promise<void> {
    const enterpriseManager = await getEnterpriseManager();
    const status = enterpriseManager.getStatus();

    if (!status.isManaged) {
      return;
    }

    this.deps.logger.info("Enterprise managed mode detected", {
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

    this.deps.logger.info("SSO required but not authenticated - prompting user");

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

  private async initializeCSPReporter(): Promise<void> {
    await this.deps.cspReportingService.initializeReporter();
  }

  private async migrateLegacyEventsIfNeeded(): Promise<void> {
    const needsMigration = await checkEventsMigrationNeeded();
    if (!needsMigration) {
      return;
    }

    const store = await this.deps.backgroundServices.events.getOrInitParquetStore();
    const result = await migrateEventsToIndexedDB(store);
    this.deps.logger.debug(`Event migration: ${result.success ? "success" : "failed"}`, result);
  }

  private initializeBackgroundServices(): void {
    this.initializeDebugBridge();

    void this.initializeEventStore().catch((error) => this.deps.logger.error("EventStore init failed:", error));
    void this.deps.backgroundServices.api.initializeApiClientWithMigration(checkMigrationNeeded, migrateToDatabase)
      .catch((error) => this.deps.logger.debug("API client init failed:", error));
    void this.deps.backgroundServices.sync.initializeSyncManagerWithAutoStart().catch((error) =>
      this.deps.logger.debug("Sync manager init failed:", error)
    );
    void this.initializeEnterpriseManagedFlow()
      .catch((error) => this.deps.logger.error("Enterprise manager init failed:", error));
    void this.initializeCSPReporter()
      .catch((error) => this.deps.logger.error("CSP reporter init failed:", error));
    void this.migrateLegacyEventsIfNeeded()
      .catch((error) => this.deps.logger.error("Event migration error:", error));
    void this.initExtensionMonitor()
      .then(() => this.deps.logger.debug("Extension monitor initialization completed"))
      .catch((error) => this.deps.logger.error("Extension monitor init failed:", error));
  }

  private registerRecurringAlarms(): void {
    // ServiceWorker keep-alive用のalarm（24秒ごとにwake-up）
    chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
    chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
    // DNR API rate limit対応: 36秒間隔（Chrome制限: 10分間に最大20回、30秒以上の間隔）
    chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
    // Extension risk analysis (runs every 5 minutes)
    chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
    // Data cleanup alarm (runs once per day)
    chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });
  }

  private registerAlarmListeners(): void {
    const alarmHandlers = createAlarmHandlersModule({
      logger,
      flushReportQueue: () => this.deps.cspReportingService.flushReportQueue(),
      checkDNRMatchesHandler: () => this.deps.extensionNetworkService.checkDNRMatchesHandler(),
      analyzeExtensionRisks: () => this.deps.extensionNetworkService.analyzeExtensionRisks(),
      cleanupOldData: this.deps.backgroundServices.config.cleanupOldData,
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "keepAlive") {
        return;
      }
      const handler = alarmHandlers.get(alarm.name);
      if (handler) {
        handler();
      }
    });
  }

  private registerRuntimeMessageHandlers(): void {
    const MAX_INCOMING_BATCH = 100;
    const PROCESS_CHUNK_SIZE = 20;
    const runtimeHandlers = createRuntimeMessageHandlersModule(
      this.createRuntimeHandlerDependencies(),
    );

    chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
      const message = rawMessage as RuntimeMessage;
      const type = typeof message.type === "string" ? message.type : "";

      if (!type) {
        this.deps.logger.debug({
          event: "RUNTIME_MESSAGE_TYPE_MISSING",
          data: {
            senderTabId: sender.tab?.id,
            senderUrl: sender.tab?.url,
          },
        });
        return false;
      }

      if (type === "BATCH_RUNTIME_EVENTS") {
        const incomingEvents = Array.isArray((message.data as { events?: unknown[] } | undefined)?.events)
          ? ((message.data as { events: RuntimeMessage[] }).events)
          : [];
        const dropped = Math.max(0, incomingEvents.length - MAX_INCOMING_BATCH);
        const events = dropped > 0
          ? incomingEvents.slice(0, MAX_INCOMING_BATCH)
          : incomingEvents;

        if (events.length === 0) {
          sendResponse({ success: true, processed: 0, failed: 0, dropped });
          return false;
        }

        void (async () => {
          let processed = 0;
          let failed = 0;
          let chunkCount = 0;

          for (const batched of events) {
            chunkCount++;
            const eventType = typeof batched?.type === "string" ? batched.type : "";
            if (!eventType) {
              failed++;
              continue;
            }

            const asyncHandler = runtimeHandlers.async.get(eventType);
            if (!asyncHandler) {
              failed++;
              continue;
            }

            try {
              await asyncHandler.execute(batched, sender);
              processed++;
            } catch (error) {
              failed++;
              this.deps.logger.debug("Batched event failed", {
                type: eventType,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            if (chunkCount >= PROCESS_CHUNK_SIZE) {
              chunkCount = 0;
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          if (dropped > 0) {
            this.deps.logger.warn("Dropped excessive batched runtime events", {
              incoming: incomingEvents.length,
              processedTarget: events.length,
              dropped,
              senderTabId: sender.tab?.id,
              senderUrl: sender.tab?.url,
            });
          }

          sendResponse({ success: true, processed, failed, dropped });
        })();

        return true;
      }

      const directHandler = runtimeHandlers.direct.get(type);
      if (directHandler) {
        return directHandler(message, sender, sendResponse);
      }

      const asyncHandler = runtimeHandlers.async.get(type);
      if (asyncHandler) {
        return runAsyncMessageHandlerModule(this.deps.logger, asyncHandler, message, sender, sendResponse);
      }

      this.deps.logger.warn({
        event: "RUNTIME_MESSAGE_TYPE_UNHANDLED",
        data: {
          type,
          senderTabId: sender.tab?.id,
          senderUrl: sender.tab?.url,
        },
      });
      return false;
    });
  }

  private createRuntimeHandlerDependencies(): RuntimeHandlerDependencies {
    const { backgroundServices, extensionNetworkService } = this.deps;

    return {
      logger: this.deps.logger,
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
      handleDebugBridgeForward: this.handleDebugBridgeForward,
      getKnownExtensions: () => extensionNetworkService.getKnownExtensions(),
      markOffscreenReady,
      handlePageAnalysis: async (payload) =>
        backgroundServices.analysis.handlePageAnalysis(payload as PageAnalysis),
      handleCSPViolation: (data, sender) =>
        this.deps.cspReportingService.handleCSPViolation(data as Omit<CSPViolation, "type">, sender),
      handleNetworkInspection: (data, sender) =>
        this.deps.networkSecurityInspector.handleNetworkInspection(data as NetworkInspectionRequest, sender),
      handleDataExfiltration: (data, sender) =>
        this.deps.securityEventHandlers.handleDataExfiltration(data as DataExfiltrationData, sender),
      handleCredentialTheft: (data, sender) =>
        this.deps.securityEventHandlers.handleCredentialTheft(data as CredentialTheftData, sender),
      handleSupplyChainRisk: (data, sender) =>
        this.deps.securityEventHandlers.handleSupplyChainRisk(data as SupplyChainRiskData, sender),
      handleTrackingBeacon: (data, sender) =>
        this.deps.securityEventHandlers.handleTrackingBeacon(data as TrackingBeaconData, sender),
      handleClipboardHijack: (data, sender) =>
        this.deps.securityEventHandlers.handleClipboardHijack(data as ClipboardHijackData, sender),
      handleCookieAccess: (data, sender) =>
        this.deps.securityEventHandlers.handleCookieAccess(data as CookieAccessData, sender),
      handleXSSDetected: (data, sender) =>
        this.deps.securityEventHandlers.handleXSSDetected(data as XSSDetectedData, sender),
      handleDOMScraping: (data, sender) =>
        this.deps.securityEventHandlers.handleDOMScraping(data as DOMScrapingData, sender),
      handleSuspiciousDownload: (data, sender) =>
        this.deps.securityEventHandlers.handleSuspiciousDownload(data as SuspiciousDownloadData, sender),
      getCSPReports: this.deps.cspReportingService.getCSPReports,
      generateCSPPolicy: this.deps.cspReportingService.generateCSPPolicy,
      generateCSPPolicyByDomain: this.deps.cspReportingService.generateCSPPolicyByDomain,
      saveGeneratedCSPPolicy: this.deps.cspReportingService.saveGeneratedCSPPolicy,
      getCSPConfig: this.deps.cspReportingService.getCSPConfig,
      setCSPConfig: this.deps.cspReportingService.setCSPConfig,
      clearCSPData: this.deps.cspReportingService.clearCSPData,
      clearAllData: () => this.clearAllData(),
      getStats: async () => {
        const client = await backgroundServices.api.ensureApiClient();
        return client.getStats();
      },
      getConnectionConfig: backgroundServices.config.getConnectionConfig,
      setConnectionConfig: backgroundServices.config.setConnectionConfig,
      getSyncConfig: backgroundServices.sync.getSyncConfig,
      setSyncConfig: backgroundServices.sync.setSyncConfig,
      triggerSync: backgroundServices.sync.triggerSync,
      getSSOManager,
      getEnterpriseManager,
      getDetectionConfig: backgroundServices.config.getDetectionConfig,
      setDetectionConfig: backgroundServices.config.setDetectionConfig,
      handleAIPromptCaptured: (payload) =>
        this.deps.aiPromptMonitorService.handleAIPromptCaptured(payload as CapturedAIPrompt),
      getAIPrompts: this.deps.aiPromptMonitorService.getAIPrompts,
      getAIPromptsCount: this.deps.aiPromptMonitorService.getAIPromptsCount,
      getAIMonitorConfig: this.deps.aiPromptMonitorService.getAIMonitorConfig,
      setAIMonitorConfig: this.deps.aiPromptMonitorService.setAIMonitorConfig,
      clearAIData: this.deps.aiPromptMonitorService.clearAIData,
      handleNRDCheck: this.deps.domainRiskService.handleNRDCheck,
      getNRDConfig: this.deps.domainRiskService.getNRDConfig,
      setNRDConfig: this.deps.domainRiskService.setNRDConfig,
      handleTyposquatCheck: this.deps.domainRiskService.handleTyposquatCheck,
      getTyposquatConfig: this.deps.domainRiskService.getTyposquatConfig,
      setTyposquatConfig: this.deps.domainRiskService.setTyposquatConfig,
      getOrInitParquetStore: backgroundServices.events.getOrInitParquetStore,
      getNetworkRequests: (options) => extensionNetworkService.getNetworkRequests(options),
      getExtensionRequests: (options) => extensionNetworkService.getExtensionRequests(options),
      getExtensionStats: () => extensionNetworkService.getExtensionStats(),
      getNetworkMonitorConfig: () => extensionNetworkService.getNetworkMonitorConfig(),
      setNetworkMonitorConfig: (newConfig) => extensionNetworkService.setNetworkMonitorConfig(newConfig),
      getAllExtensionRisks: () => extensionNetworkService.getAllExtensionRisks(),
      getExtensionRiskAnalysis: (extensionId) => extensionNetworkService.getExtensionRiskAnalysis(extensionId),
      analyzeExtensionRisks: () => extensionNetworkService.analyzeExtensionRisks(),
      getDataRetentionConfig: backgroundServices.config.getDataRetentionConfig,
      setDataRetentionConfig: backgroundServices.config.setDataRetentionConfig,
      cleanupOldData: backgroundServices.config.cleanupOldData,
      getBlockingConfig: backgroundServices.config.getBlockingConfig,
      setBlockingConfig: backgroundServices.config.setBlockingConfig,
      getNotificationConfig: backgroundServices.config.getNotificationConfig,
      setNotificationConfig: backgroundServices.config.setNotificationConfig,
      getDoHMonitorConfig: () => this.deps.doHMonitorManager.getConfig(),
      setDoHMonitorConfig: (config) => this.deps.doHMonitorManager.setConfig(config),
      getDoHRequests: (options) => this.deps.doHMonitorManager.getRequests(options),
    };
  }

  private async initExtensionMonitor(): Promise<void> {
    await this.deps.extensionNetworkService.initExtensionMonitor();
  }
}

const backgroundRuntime = new BackgroundRuntime({
  logger,
  backgroundServices,
  extensionNetworkService,
  cspReportingService,
  aiPromptMonitorService,
  domainRiskService,
  securityEventHandlers,
  networkSecurityInspector,
  doHMonitorManager,
});

export default defineBackground(() => backgroundRuntime.start());
