import { DEFAULT_DETECTION_CONFIG, clearAIPrompts, createLogger, getStorage, setStorage } from "@pleno-audit/extension-runtime";
import { createAIPromptMonitorService } from "../ai-prompt-monitor-service";
import { createBackgroundServices, type NewEvent } from "../background-services";
import { createCSPReportingService } from "../csp-reporting-service";
import { createDomainRiskService } from "../domain-risk-service";
import { createSecurityEventHandlers } from "../security-event-handlers";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

export function createBackgroundContext() {
  const logger = createLogger("background");
  const backgroundServices = createBackgroundServices(logger);
  const {
    api: backgroundApi,
    sync: backgroundSync,
    events: backgroundEvents,
    alerts: backgroundAlerts,
    storage: backgroundStorage,
    analysis: backgroundAnalysis,
    config: backgroundConfig,
    utils: backgroundUtils,
  } = backgroundServices;

  backgroundAlerts.registerNotificationClickHandler();

  const securityEventHandlers = createSecurityEventHandlers({
    addEvent: (event) => backgroundEvents.addEvent(event as NewEvent),
    getAlertManager: backgroundAlerts.getAlertManager,
    extractDomainFromUrl: backgroundUtils.extractDomainFromUrl,
    checkDataTransferPolicy: backgroundAlerts.checkDataTransferPolicy,
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

  return {
    logger,
    backgroundServices,
    backgroundApi,
    backgroundSync,
    backgroundEvents,
    backgroundAlerts,
    backgroundStorage,
    backgroundAnalysis,
    backgroundConfig,
    backgroundUtils,
    securityEventHandlers,
    cspReportingService,
    aiPromptMonitorService,
    domainRiskService,
  };
}

export type BackgroundContext = ReturnType<typeof createBackgroundContext>;
