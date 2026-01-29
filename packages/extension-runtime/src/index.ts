/**
 * @fileoverview Extension Runtime Package (Shim)
 *
 * This package is a backward-compatibility shim that re-exports from ZTA packages.
 * New code should import directly from the specific ZTA packages.
 *
 * @deprecated Import from specific ZTA packages instead:
 * - @pleno-audit/runtime-platform (Logger, BrowserAdapter, MessageHandler)
 * - @pleno-audit/activity-logs (Storage, ApiClient, SyncManager) - future
 * - @pleno-audit/cdm (ExtensionRiskAnalyzer, DoHMonitor, CookieMonitor, SuspiciousPatternDetector)
 * - @pleno-audit/pep (BlockingEngine, CooldownManager, AlertManager)
 * - @pleno-audit/siem (ExtensionStatsAnalyzer)
 * - @pleno-audit/id-management (SSOManager)
 * - @pleno-audit/policy-admin (EnterpriseManager)
 */

// =============================================================================
// Re-exports from ZTA packages (migrated)
// =============================================================================

// Re-export from runtime-platform
export {
  createLogger,
  setDebuggerSink,
  hasDebuggerSink,
  type Logger,
  type LogLevel,
  type LogEntry,
  createMessageRouter,
  fireAndForget,
  createBrowserAdapter,
  browserAdapter,
  getBrowserAPI,
  isFirefox,
  isChrome,
  isExtensionContext,
  hasSessionStorage,
  hasManagedStorage,
  hasIdentityAPI,
  isManifestV3,
  getSessionStorage,
  setSessionStorage,
  removeSessionStorage,
} from "@pleno-audit/runtime-platform";

// Re-export from cdm
export {
  startCookieMonitor,
  onCookieChange,
  type CookieChangeCallback,
  detectAllSuspiciousPatterns,
  detectBulkRequests,
  detectLateNightActivity,
  detectEncodedParameters,
  detectDomainDiversity,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
  type SuspiciousPattern,
  type SuspiciousPatternConfig,
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
  createDoHMonitor,
  registerDoHMonitorListener,
  clearDoHCallbacks,
  detectDoHRequest,
  DEFAULT_DOH_MONITOR_CONFIG,
  DOH_URL_PATTERNS,
  type DoHMonitor,
  type DoHAction,
  type DoHMonitorConfig,
  type DoHRequestRecord,
  type DoHDetectionMethod,
} from "@pleno-audit/cdm";

// Re-export from pep
export {
  createBlockingEngine,
  type BlockTarget,
  type BlockDecision,
  type BlockEvent,
  type BlockingEngine,
  createCooldownManager,
  createInMemoryCooldownStorage,
  createPersistentCooldownStorage,
  type CooldownStorage,
  type CooldownManager,
  type CooldownManagerConfig,
  DEFAULT_BLOCKING_CONFIG,
  type BlockingConfig,
} from "@pleno-audit/pep";

// Re-export from siem
export {
  generateExtensionStats,
  generateDailyTimeSeries,
  generateWeeklyTimeSeries,
  generateDashboardStats,
  ExtensionStatsCache,
  globalExtensionStatsCache,
  type ExtensionStats,
  type TimeSeriesData,
  type DashboardStats,
} from "@pleno-audit/siem";

// Re-export from id-management
export {
  getSSOManager,
  createSSOManager,
  type SSOProvider,
  type OIDCConfig,
  type SAMLConfig,
  type SSOConfig,
  type SSOSession,
  type SSOStatus,
} from "@pleno-audit/id-management";

// Re-export from policy-admin
export {
  getEnterpriseManager,
  createEnterpriseManager,
  EnterpriseManager,
  type EnterpriseManagedConfig,
  type EnterpriseStatus,
  type EnterpriseSSOConfig,
  type EnterprisePolicyConfig,
  type EnterpriseReportingConfig,
  type DetectionConfig,
  type NotificationConfig,
} from "@pleno-audit/policy-admin";

// =============================================================================
// Local exports (not yet migrated to ZTA packages)
// TODO: Migrate to @pleno-audit/activity-logs
// =============================================================================

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
  clearAllStorage,
} from "./storage.js";

// API Client
export {
  ApiClient,
  getApiClient,
  updateApiClientConfig,
  ensureOffscreenDocument,
  type ConnectionMode,
  type ApiClientConfig,
  type QueryOptions,
  type PaginatedResult,
} from "./api-client.js";

// Sync Manager
export { SyncManager, getSyncManager } from "./sync-manager.js";

// Migration
export { checkMigrationNeeded, migrateToDatabase } from "./migration.js";

// Re-export types from storage-types (not yet migrated)
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
  AlertCooldownData,
} from "./storage-types.js";
export {
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
} from "./storage-types.js";

// Extension Monitor (not yet migrated to cdm)
export {
  createExtensionMonitor,
  registerExtensionMonitorListener,
  clearGlobalCallbacks,
  DEFAULT_EXTENSION_MONITOR_CONFIG,
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  type ExtensionMonitor,
  type ExtensionInfo,
} from "./extension-monitor.js";
