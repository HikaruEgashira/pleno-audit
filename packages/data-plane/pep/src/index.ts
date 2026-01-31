// Blocking Types
export type { BlockingConfig } from "./blocking-types.js";
export { DEFAULT_BLOCKING_CONFIG } from "./blocking-types.js";

// Blocking Engine
export {
  createBlockingEngine,
  type BlockTarget,
  type BlockDecision,
  type BlockEvent,
  type BlockingEngine,
} from "./blocking-engine.js";

// Cooldown Manager
export {
  createCooldownManager,
  createInMemoryCooldownStorage,
  createPersistentCooldownStorage,
  type CooldownStorage,
  type CooldownManager,
  type CooldownManagerConfig,
} from "./cooldown-manager.js";

// Alert Types
export type {
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  SecurityAlert,
  AlertDetails,
  NRDAlertDetails,
  TyposquatAlertDetails,
  DataLeakAlertDetails,
  DataExfiltrationAlertDetails,
  CredentialTheftAlertDetails,
  SupplyChainAlertDetails,
  CSPAlertDetails,
  AISensitiveAlertDetails,
  ShadowAIAlertDetails,
  ExtensionAlertDetails,
  LoginAlertDetails,
  PolicyAlertDetails,
  ComplianceAlertDetails,
  PolicyViolationAlertDetails,
  TrackingBeaconAlertDetails,
  ClipboardHijackAlertDetails,
  CookieAccessAlertDetails,
  XSSInjectionAlertDetails,
  DOMScrapingAlertDetails,
  SuspiciousDownloadAlertDetails,
  AlertAction,
  AlertRule,
  AlertCondition,
  AlertConfig,
} from "./alert-types.js";
export { DEFAULT_ALERT_CONFIG, DEFAULT_ALERT_RULES } from "./alert-types.js";

// Alert Manager
export {
  createAlertManager,
  createInMemoryAlertStore,
  type AlertStore,
  type AlertListener,
  type AlertManager,
} from "./alert-manager.js";
