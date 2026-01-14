/**
 * @fileoverview Alert System Package
 *
 * Real-time security alerting system for immediate threat response.
 * Wiz-style alerts for NRD, typosquat, threats, and data leaks.
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
  ThreatAlertDetails,
  DataLeakAlertDetails,
  CSPAlertDetails,
  AISensitiveAlertDetails,
  ExtensionAlertDetails,
  LoginAlertDetails,
  PolicyAlertDetails,
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
