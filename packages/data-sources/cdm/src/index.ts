// CDM Types
export type {
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
  DoHDetectionMethod,
  DoHAction,
  DoHMonitorConfig,
  DoHRequestRecord,
} from "./cdm-types.js";

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

// Suspicious Pattern Detector
export {
  detectAllSuspiciousPatterns,
  detectBulkRequests,
  detectLateNightActivity,
  detectEncodedParameters,
  detectDomainDiversity,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
  type SuspiciousPattern,
  type SuspiciousPatternConfig,
} from "./suspicious-pattern-detector.js";

// DoH Monitor
export {
  createDoHMonitor,
  registerDoHMonitorListener,
  clearDoHCallbacks,
  detectDoHRequest,
  DEFAULT_DOH_MONITOR_CONFIG,
  DOH_URL_PATTERNS,
  type DoHMonitor,
} from "./doh-monitor.js";

// Cookie Monitor
export {
  startCookieMonitor,
  onCookieChange,
  type CookieChangeCallback,
} from "./cookie-monitor.js";
