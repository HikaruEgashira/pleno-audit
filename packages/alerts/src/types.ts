/**
 * @fileoverview Alert System Types
 *
 * Types for real-time security alerts and notifications.
 * Wiz-style alerting for immediate threat response.
 */

/**
 * Alert severity levels
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Alert categories
 */
export type AlertCategory =
  | "nrd" // Newly registered domain
  | "typosquat" // Typosquatting attempt
  | "data_leak" // Sensitive data exposure
  | "data_exfiltration" // Large data transfer (potential exfiltration)
  | "csp_violation" // CSP policy violation
  | "ai_sensitive" // Sensitive data in AI prompt
  | "shadow_ai" // Unauthorized/unknown AI service
  | "extension" // Suspicious extension activity
  | "login" // Login on suspicious site
  | "policy"; // Missing privacy/ToS policy

/**
 * Alert status
 */
export type AlertStatus =
  | "new" // Just created
  | "acknowledged" // User has seen it
  | "investigating" // Under investigation
  | "resolved" // Issue resolved
  | "dismissed"; // False positive / ignored

/**
 * Security alert
 */
export interface SecurityAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  domain: string;
  timestamp: number;
  details: AlertDetails;
  actions: AlertAction[];
  metadata?: Record<string, unknown>;
}

/**
 * Alert details by category
 */
export type AlertDetails =
  | NRDAlertDetails
  | TyposquatAlertDetails
  | DataLeakAlertDetails
  | DataExfiltrationAlertDetails
  | CSPAlertDetails
  | AISensitiveAlertDetails
  | ShadowAIAlertDetails
  | ExtensionAlertDetails
  | LoginAlertDetails
  | PolicyAlertDetails;

export interface NRDAlertDetails {
  type: "nrd";
  domainAge: number | null;
  registrationDate: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
}

export interface TyposquatAlertDetails {
  type: "typosquat";
  targetDomain?: string;
  homoglyphCount: number;
  confidence: "high" | "medium" | "low" | "none";
}

export interface DataLeakAlertDetails {
  type: "data_leak";
  dataTypes: string[];
  destination: string;
  maskedSample?: string;
}

export interface CSPAlertDetails {
  type: "csp";
  directive: string;
  blockedURL: string;
  violationCount: number;
}

export interface AISensitiveAlertDetails {
  type: "ai_sensitive";
  provider: string;
  model?: string;
  dataTypes: string[];
}

export interface ShadowAIAlertDetails {
  type: "shadow_ai";
  provider: string;
  providerDisplayName: string;
  category: "major" | "enterprise" | "open_source" | "regional" | "specialized";
  riskLevel: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  model?: string;
}

export interface ExtensionAlertDetails {
  type: "extension";
  extensionId: string;
  extensionName: string;
  requestCount: number;
  targetDomains: string[];
}

export interface LoginAlertDetails {
  type: "login";
  hasForm: boolean;
  isNRD: boolean;
  isTyposquat: boolean;
}

export interface PolicyAlertDetails {
  type: "policy";
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasLogin: boolean;
}

export interface DataExfiltrationAlertDetails {
  type: "data_exfiltration";
  sourceDomain: string;
  targetDomain: string;
  bodySize: number;
  sizeKB: number;
  method: string;
  initiator: string;
}

/**
 * Recommended action for an alert
 */
export interface AlertAction {
  id: string;
  label: string;
  type: "block" | "investigate" | "dismiss" | "report" | "custom";
  url?: string;
}

/**
 * Alert rule for triggering alerts
 */
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  category: AlertCategory;
  condition: AlertCondition;
  severity: AlertSeverity;
  actions: AlertAction[];
}

/**
 * Condition for triggering an alert
 */
export interface AlertCondition {
  type: "always" | "threshold" | "pattern";
  threshold?: number;
  pattern?: string;
  field?: string;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  showNotifications: boolean;
  playSound: boolean;
  rules: AlertRule[];
  severityFilter: AlertSeverity[];
}

/**
 * Default alert configuration
 */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  showNotifications: true,
  playSound: false,
  rules: [],
  severityFilter: ["critical", "high"],
};

/**
 * Default alert rules
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "nrd-high",
    name: "High confidence NRD",
    enabled: true,
    category: "nrd",
    condition: { type: "always" },
    severity: "high",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
  {
    id: "typosquat-high",
    name: "High confidence typosquat",
    enabled: true,
    category: "typosquat",
    condition: { type: "always" },
    severity: "critical",
    actions: [
      { id: "block", label: "ブロック", type: "block" },
      { id: "report", label: "報告", type: "report" },
    ],
  },
  {
    id: "data-leak-credentials",
    name: "Credentials in AI prompt",
    enabled: true,
    category: "ai_sensitive",
    condition: { type: "pattern", pattern: "credentials" },
    severity: "critical",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
    ],
  },
  {
    id: "login-suspicious",
    name: "Login on suspicious domain",
    enabled: true,
    category: "login",
    condition: { type: "always" },
    severity: "high",
    actions: [
      { id: "investigate", label: "調査", type: "investigate" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ],
  },
];
