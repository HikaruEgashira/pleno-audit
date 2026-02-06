import type {
  RuntimeHandlerDependencies,
  RuntimeHandlerFallbacks,
} from "./runtime-handlers/types";

interface RuntimeHandlerServiceGroups {
  logger: RuntimeHandlerDependencies["logger"];
  fallbacks: RuntimeHandlerFallbacks;
  debugBridge: {
    handleDebugBridgeForward: RuntimeHandlerDependencies["handleDebugBridgeForward"];
  };
  extensionNetwork: {
    getKnownExtensions: RuntimeHandlerDependencies["getKnownExtensions"];
    getNetworkRequests: RuntimeHandlerDependencies["getNetworkRequests"];
    getExtensionRequests: RuntimeHandlerDependencies["getExtensionRequests"];
    getExtensionStats: RuntimeHandlerDependencies["getExtensionStats"];
    getNetworkMonitorConfig: RuntimeHandlerDependencies["getNetworkMonitorConfig"];
    setNetworkMonitorConfig: RuntimeHandlerDependencies["setNetworkMonitorConfig"];
    getAllExtensionRisks: RuntimeHandlerDependencies["getAllExtensionRisks"];
    getExtensionRiskAnalysis: RuntimeHandlerDependencies["getExtensionRiskAnalysis"];
    analyzeExtensionRisks: RuntimeHandlerDependencies["analyzeExtensionRisks"];
  };
  pageAnalysis: {
    handlePageAnalysis: RuntimeHandlerDependencies["handlePageAnalysis"];
  };
  cspReporting: {
    handleCSPViolation: RuntimeHandlerDependencies["handleCSPViolation"];
    handleNetworkRequest: RuntimeHandlerDependencies["handleNetworkRequest"];
    getCSPReports: RuntimeHandlerDependencies["getCSPReports"];
    generateCSPPolicy: RuntimeHandlerDependencies["generateCSPPolicy"];
    generateCSPPolicyByDomain: RuntimeHandlerDependencies["generateCSPPolicyByDomain"];
    saveGeneratedCSPPolicy: RuntimeHandlerDependencies["saveGeneratedCSPPolicy"];
    getCSPConfig: RuntimeHandlerDependencies["getCSPConfig"];
    setCSPConfig: RuntimeHandlerDependencies["setCSPConfig"];
    clearCSPData: RuntimeHandlerDependencies["clearCSPData"];
  };
  securityEvents: {
    handleDataExfiltration: RuntimeHandlerDependencies["handleDataExfiltration"];
    handleCredentialTheft: RuntimeHandlerDependencies["handleCredentialTheft"];
    handleSupplyChainRisk: RuntimeHandlerDependencies["handleSupplyChainRisk"];
    handleTrackingBeacon: RuntimeHandlerDependencies["handleTrackingBeacon"];
    handleClipboardHijack: RuntimeHandlerDependencies["handleClipboardHijack"];
    handleCookieAccess: RuntimeHandlerDependencies["handleCookieAccess"];
    handleXSSDetected: RuntimeHandlerDependencies["handleXSSDetected"];
    handleDOMScraping: RuntimeHandlerDependencies["handleDOMScraping"];
    handleSuspiciousDownload: RuntimeHandlerDependencies["handleSuspiciousDownload"];
  };
  connection: {
    getConnectionConfig: RuntimeHandlerDependencies["getConnectionConfig"];
    setConnectionConfig: RuntimeHandlerDependencies["setConnectionConfig"];
    getSyncConfig: RuntimeHandlerDependencies["getSyncConfig"];
    setSyncConfig: RuntimeHandlerDependencies["setSyncConfig"];
    triggerSync: RuntimeHandlerDependencies["triggerSync"];
  };
  enterprise: {
    getSSOManager: RuntimeHandlerDependencies["getSSOManager"];
    getEnterpriseManager: RuntimeHandlerDependencies["getEnterpriseManager"];
  };
  detectionConfig: {
    getDetectionConfig: RuntimeHandlerDependencies["getDetectionConfig"];
    setDetectionConfig: RuntimeHandlerDependencies["setDetectionConfig"];
  };
  aiPrompt: {
    handleAIPromptCaptured: RuntimeHandlerDependencies["handleAIPromptCaptured"];
    getAIPrompts: RuntimeHandlerDependencies["getAIPrompts"];
    getAIPromptsCount: RuntimeHandlerDependencies["getAIPromptsCount"];
    getAIMonitorConfig: RuntimeHandlerDependencies["getAIMonitorConfig"];
    setAIMonitorConfig: RuntimeHandlerDependencies["setAIMonitorConfig"];
    clearAIData: RuntimeHandlerDependencies["clearAIData"];
  };
  domainRisk: {
    handleNRDCheck: RuntimeHandlerDependencies["handleNRDCheck"];
    getNRDConfig: RuntimeHandlerDependencies["getNRDConfig"];
    setNRDConfig: RuntimeHandlerDependencies["setNRDConfig"];
    handleTyposquatCheck: RuntimeHandlerDependencies["handleTyposquatCheck"];
    getTyposquatConfig: RuntimeHandlerDependencies["getTyposquatConfig"];
    setTyposquatConfig: RuntimeHandlerDependencies["setTyposquatConfig"];
  };
  parquet: {
    getOrInitParquetStore: RuntimeHandlerDependencies["getOrInitParquetStore"];
  };
  dataRetention: {
    getDataRetentionConfig: RuntimeHandlerDependencies["getDataRetentionConfig"];
    setDataRetentionConfig: RuntimeHandlerDependencies["setDataRetentionConfig"];
    cleanupOldData: RuntimeHandlerDependencies["cleanupOldData"];
  };
  blocking: {
    getBlockingConfig: RuntimeHandlerDependencies["getBlockingConfig"];
    setBlockingConfig: RuntimeHandlerDependencies["setBlockingConfig"];
  };
  notification: {
    getNotificationConfig: RuntimeHandlerDependencies["getNotificationConfig"];
    setNotificationConfig: RuntimeHandlerDependencies["setNotificationConfig"];
  };
  doH: {
    getDoHMonitorConfig: RuntimeHandlerDependencies["getDoHMonitorConfig"];
    setDoHMonitorConfig: RuntimeHandlerDependencies["setDoHMonitorConfig"];
    getDoHRequests: RuntimeHandlerDependencies["getDoHRequests"];
  };
  dataManagement: {
    clearAllData: RuntimeHandlerDependencies["clearAllData"];
  };
  stats: {
    getStats: RuntimeHandlerDependencies["getStats"];
  };
}

export function createRuntimeHandlerDependencies(
  services: RuntimeHandlerServiceGroups
): RuntimeHandlerDependencies {
  return {
    logger: services.logger,
    fallbacks: services.fallbacks,
    handleDebugBridgeForward: services.debugBridge.handleDebugBridgeForward,
    getKnownExtensions: services.extensionNetwork.getKnownExtensions,
    handlePageAnalysis: services.pageAnalysis.handlePageAnalysis,
    handleCSPViolation: services.cspReporting.handleCSPViolation,
    handleNetworkRequest: services.cspReporting.handleNetworkRequest,
    handleDataExfiltration: services.securityEvents.handleDataExfiltration,
    handleCredentialTheft: services.securityEvents.handleCredentialTheft,
    handleSupplyChainRisk: services.securityEvents.handleSupplyChainRisk,
    handleTrackingBeacon: services.securityEvents.handleTrackingBeacon,
    handleClipboardHijack: services.securityEvents.handleClipboardHijack,
    handleCookieAccess: services.securityEvents.handleCookieAccess,
    handleXSSDetected: services.securityEvents.handleXSSDetected,
    handleDOMScraping: services.securityEvents.handleDOMScraping,
    handleSuspiciousDownload: services.securityEvents.handleSuspiciousDownload,
    getCSPReports: services.cspReporting.getCSPReports,
    generateCSPPolicy: services.cspReporting.generateCSPPolicy,
    generateCSPPolicyByDomain: services.cspReporting.generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy: services.cspReporting.saveGeneratedCSPPolicy,
    getCSPConfig: services.cspReporting.getCSPConfig,
    setCSPConfig: services.cspReporting.setCSPConfig,
    clearCSPData: services.cspReporting.clearCSPData,
    clearAllData: services.dataManagement.clearAllData,
    getStats: services.stats.getStats,
    getConnectionConfig: services.connection.getConnectionConfig,
    setConnectionConfig: services.connection.setConnectionConfig,
    getSyncConfig: services.connection.getSyncConfig,
    setSyncConfig: services.connection.setSyncConfig,
    triggerSync: services.connection.triggerSync,
    getSSOManager: services.enterprise.getSSOManager,
    getEnterpriseManager: services.enterprise.getEnterpriseManager,
    getDetectionConfig: services.detectionConfig.getDetectionConfig,
    setDetectionConfig: services.detectionConfig.setDetectionConfig,
    handleAIPromptCaptured: services.aiPrompt.handleAIPromptCaptured,
    getAIPrompts: services.aiPrompt.getAIPrompts,
    getAIPromptsCount: services.aiPrompt.getAIPromptsCount,
    getAIMonitorConfig: services.aiPrompt.getAIMonitorConfig,
    setAIMonitorConfig: services.aiPrompt.setAIMonitorConfig,
    clearAIData: services.aiPrompt.clearAIData,
    handleNRDCheck: services.domainRisk.handleNRDCheck,
    getNRDConfig: services.domainRisk.getNRDConfig,
    setNRDConfig: services.domainRisk.setNRDConfig,
    handleTyposquatCheck: services.domainRisk.handleTyposquatCheck,
    getTyposquatConfig: services.domainRisk.getTyposquatConfig,
    setTyposquatConfig: services.domainRisk.setTyposquatConfig,
    getOrInitParquetStore: services.parquet.getOrInitParquetStore,
    getNetworkRequests: services.extensionNetwork.getNetworkRequests,
    getExtensionRequests: services.extensionNetwork.getExtensionRequests,
    getExtensionStats: services.extensionNetwork.getExtensionStats,
    getNetworkMonitorConfig: services.extensionNetwork.getNetworkMonitorConfig,
    setNetworkMonitorConfig: services.extensionNetwork.setNetworkMonitorConfig,
    getAllExtensionRisks: services.extensionNetwork.getAllExtensionRisks,
    getExtensionRiskAnalysis: services.extensionNetwork.getExtensionRiskAnalysis,
    analyzeExtensionRisks: services.extensionNetwork.analyzeExtensionRisks,
    getDataRetentionConfig: services.dataRetention.getDataRetentionConfig,
    setDataRetentionConfig: services.dataRetention.setDataRetentionConfig,
    cleanupOldData: services.dataRetention.cleanupOldData,
    getBlockingConfig: services.blocking.getBlockingConfig,
    setBlockingConfig: services.blocking.setBlockingConfig,
    getNotificationConfig: services.notification.getNotificationConfig,
    setNotificationConfig: services.notification.setNotificationConfig,
    getDoHMonitorConfig: services.doH.getDoHMonitorConfig,
    setDoHMonitorConfig: services.doH.setDoHMonitorConfig,
    getDoHRequests: services.doH.getDoHRequests,
  };
}
