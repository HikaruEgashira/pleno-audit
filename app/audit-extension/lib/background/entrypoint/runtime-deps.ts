import type { CapturedAIPrompt } from "@pleno-audit/detectors";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
} from "@pleno-audit/detectors";
import {
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_DOH_MONITOR_CONFIG,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "@pleno-audit/extension-runtime";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import { createDebugBridgeHandler } from "../debug-bridge-handler";
import type { RuntimeHandlerDependencies } from "../runtime-handlers";
import type {
  ClipboardHijackData,
  CookieAccessData,
  DOMScrapingData,
  DataExfiltrationData,
  CredentialTheftData,
  SupplyChainRiskData,
  SuspiciousDownloadData,
  TrackingBeaconData,
  XSSDetectedData,
} from "../security-event-handlers";
import type { BackgroundContext } from "./context";
import type { DoHMonitorService } from "./doh-monitor-service";
import type { ExtensionNetworkGateway } from "./extension-network-gateway";
import type { PageAnalysis } from "../background-services";

interface RuntimeDepsParams {
  context: BackgroundContext;
  extensionNetwork: ExtensionNetworkGateway;
  doHMonitor: DoHMonitorService;
  clearAllData: () => Promise<{ success: boolean }>;
  getSSOManager: RuntimeHandlerDependencies["getSSOManager"];
  getEnterpriseManager: RuntimeHandlerDependencies["getEnterpriseManager"];
}

export function createRuntimeHandlerDependencies(params: RuntimeDepsParams): RuntimeHandlerDependencies {
  const { context, extensionNetwork, doHMonitor, clearAllData, getSSOManager, getEnterpriseManager } = params;

  const handleDebugBridgeForward = createDebugBridgeHandler({
    getOrInitParquetStore: context.backgroundEvents.getOrInitParquetStore,
    getDoHMonitorConfig: doHMonitor.getDoHMonitorConfig,
    setDoHMonitorConfig: doHMonitor.setDoHMonitorConfig,
    getDoHRequests: doHMonitor.getDoHRequests,
  });

  return {
    logger: context.logger,
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
    handleDebugBridgeForward,
    getKnownExtensions: extensionNetwork.getKnownExtensions,
    handlePageAnalysis: async (payload) =>
      context.backgroundAnalysis.handlePageAnalysis(payload as PageAnalysis),
    handleCSPViolation: (data, sender) =>
      context.cspReportingService.handleCSPViolation(data as Omit<CSPViolation, "type">, sender),
    handleNetworkRequest: (data, sender) =>
      context.cspReportingService.handleNetworkRequest(data as Omit<NetworkRequest, "type">, sender),
    handleDataExfiltration: (data, sender) =>
      context.securityEventHandlers.handleDataExfiltration(data as DataExfiltrationData, sender),
    handleCredentialTheft: (data, sender) =>
      context.securityEventHandlers.handleCredentialTheft(data as CredentialTheftData, sender),
    handleSupplyChainRisk: (data, sender) =>
      context.securityEventHandlers.handleSupplyChainRisk(data as SupplyChainRiskData, sender),
    handleTrackingBeacon: (data, sender) =>
      context.securityEventHandlers.handleTrackingBeacon(data as TrackingBeaconData, sender),
    handleClipboardHijack: (data, sender) =>
      context.securityEventHandlers.handleClipboardHijack(data as ClipboardHijackData, sender),
    handleCookieAccess: (data, sender) =>
      context.securityEventHandlers.handleCookieAccess(data as CookieAccessData, sender),
    handleXSSDetected: (data, sender) =>
      context.securityEventHandlers.handleXSSDetected(data as XSSDetectedData, sender),
    handleDOMScraping: (data, sender) =>
      context.securityEventHandlers.handleDOMScraping(data as DOMScrapingData, sender),
    handleSuspiciousDownload: (data, sender) =>
      context.securityEventHandlers.handleSuspiciousDownload(data as SuspiciousDownloadData, sender),
    getCSPReports: context.cspReportingService.getCSPReports,
    generateCSPPolicy: context.cspReportingService.generateCSPPolicy,
    generateCSPPolicyByDomain: context.cspReportingService.generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy: context.cspReportingService.saveGeneratedCSPPolicy,
    getCSPConfig: context.cspReportingService.getCSPConfig,
    setCSPConfig: context.cspReportingService.setCSPConfig,
    clearCSPData: context.cspReportingService.clearCSPData,
    clearAllData,
    getStats: async () => {
      const client = await context.backgroundApi.ensureApiClient();
      return client.getStats();
    },
    getConnectionConfig: context.backgroundConfig.getConnectionConfig,
    setConnectionConfig: context.backgroundConfig.setConnectionConfig,
    getSyncConfig: context.backgroundSync.getSyncConfig,
    setSyncConfig: context.backgroundSync.setSyncConfig,
    triggerSync: context.backgroundSync.triggerSync,
    getSSOManager,
    getEnterpriseManager,
    getDetectionConfig: context.backgroundConfig.getDetectionConfig,
    setDetectionConfig: context.backgroundConfig.setDetectionConfig,
    handleAIPromptCaptured: (payload) =>
      context.aiPromptMonitorService.handleAIPromptCaptured(payload as CapturedAIPrompt),
    getAIPrompts: context.aiPromptMonitorService.getAIPrompts,
    getAIPromptsCount: context.aiPromptMonitorService.getAIPromptsCount,
    getAIMonitorConfig: context.aiPromptMonitorService.getAIMonitorConfig,
    setAIMonitorConfig: context.aiPromptMonitorService.setAIMonitorConfig,
    clearAIData: context.aiPromptMonitorService.clearAIData,
    handleNRDCheck: context.domainRiskService.handleNRDCheck,
    getNRDConfig: context.domainRiskService.getNRDConfig,
    setNRDConfig: context.domainRiskService.setNRDConfig,
    handleTyposquatCheck: context.domainRiskService.handleTyposquatCheck,
    getTyposquatConfig: context.domainRiskService.getTyposquatConfig,
    setTyposquatConfig: context.domainRiskService.setTyposquatConfig,
    getOrInitParquetStore: context.backgroundEvents.getOrInitParquetStore,
    getNetworkRequests: extensionNetwork.getNetworkRequests,
    getExtensionRequests: extensionNetwork.getExtensionRequests,
    getExtensionStats: extensionNetwork.getExtensionStats,
    getNetworkMonitorConfig: extensionNetwork.getNetworkMonitorConfig,
    setNetworkMonitorConfig: extensionNetwork.setNetworkMonitorConfig,
    getAllExtensionRisks: extensionNetwork.getAllExtensionRisks,
    getExtensionRiskAnalysis: extensionNetwork.getExtensionRiskAnalysis,
    analyzeExtensionRisks: extensionNetwork.analyzeExtensionRisks,
    getDataRetentionConfig: context.backgroundConfig.getDataRetentionConfig,
    setDataRetentionConfig: context.backgroundConfig.setDataRetentionConfig,
    cleanupOldData: context.backgroundConfig.cleanupOldData,
    getBlockingConfig: context.backgroundConfig.getBlockingConfig,
    setBlockingConfig: context.backgroundConfig.setBlockingConfig,
    getNotificationConfig: context.backgroundConfig.getNotificationConfig,
    setNotificationConfig: context.backgroundConfig.setNotificationConfig,
    getDoHMonitorConfig: doHMonitor.getDoHMonitorConfig,
    setDoHMonitorConfig: doHMonitor.setDoHMonitorConfig,
    getDoHRequests: doHMonitor.getDoHRequests,
  };
}
