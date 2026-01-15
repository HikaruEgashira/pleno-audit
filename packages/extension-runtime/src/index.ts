// Storage
export type { StorageData } from "./storage-types.js";
export {
  queueStorageOperation,
  getStorage,
  setStorage,
  getStorageKey,
  getServiceCount,
  clearCSPReports,
  clearAIPrompts,
} from "./storage.js";

// API Client
export {
  ApiClient,
  getApiClient,
  updateApiClientConfig,
  type ConnectionMode,
  type ApiClientConfig,
  type QueryOptions,
  type PaginatedResult,
} from "./api-client.js";

// Sync Manager
export { SyncManager, getSyncManager } from "./sync-manager.js";

// Migration
export { checkMigrationNeeded, migrateToDatabase } from "./migration.js";

// Cookie Monitor
export {
  startCookieMonitor,
  onCookieChange,
  type CookieChangeCallback,
} from "./cookie-monitor.js";

// Message Handler
export { createMessageRouter, fireAndForget } from "./message-handler.js";

// Browser Adapter
export { createBrowserAdapter, browserAdapter } from "./browser-adapter.js";

// Re-export types from storage-types
export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
  DataRetentionConfig,
  DetectionConfig,
  BlockingConfig,
} from "./storage-types.js";
export {
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
} from "./storage-types.js";

// Extension Monitor
export {
  createExtensionMonitor,
  registerExtensionMonitorListener,
  DEFAULT_EXTENSION_MONITOR_CONFIG,
  type ExtensionMonitor,
  type ExtensionInfo,
} from "./extension-monitor.js";

// Extension Risk Analyzer
export {
  DANGEROUS_PERMISSIONS,
  analyzePermissions,
  analyzeNetworkActivity,
  calculateRiskScore,
  scoreToRiskLevel,
  generateRiskFlags,
  analyzeExtensionRisk,
  analyzeInstalledExtension,
  type PermissionRiskCategory,
  type PermissionRisk,
  type ExtensionRiskAnalysis,
  type NetworkRisk,
  type RiskFlag,
} from "./extension-risk-analyzer.js";

// Blocking Engine
export {
  createBlockingEngine,
  type BlockTarget,
  type BlockDecision,
  type BlockEvent,
  type BlockingEngine,
} from "./blocking-engine.js";

// Logger
export {
  createLogger,
  setDebuggerSink,
  hasDebuggerSink,
  type Logger,
  type LogLevel,
  type LogEntry,
} from "./logger.js";

// SSO Manager
export {
  getSSOManager,
  createSSOManager,
  type SSOProvider,
  type OIDCConfig,
  type SAMLConfig,
  type SSOConfig,
  type SSOSession,
  type SSOStatus,
} from "./sso-manager.js";
