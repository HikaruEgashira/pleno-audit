/**
 * @fileoverview Alert System Package
 *
 * Real-time security alerting system for immediate response.
 * Wiz-style alerts for NRD, typosquat, and data leaks.
 */

// Types
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
  AlertAction,
  AlertRule,
  AlertCondition,
  AlertConfig,
} from "./types.js";

export { DEFAULT_ALERT_CONFIG, DEFAULT_ALERT_RULES } from "./types.js";

// Alert Manager
export {
  createAlertManager,
  createInMemoryAlertStore,
  type AlertManager,
  type AlertStore,
  type AlertListener,
} from "./alert-manager.js";
