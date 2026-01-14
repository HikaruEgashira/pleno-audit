/**
 * @fileoverview Runtime Protection Types
 *
 * Wiz Defend-style runtime threat detection for browser security.
 * Real-time monitoring and incident management.
 */

/**
 * Threat severity levels
 */
export type ThreatSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Threat status
 */
export type ThreatStatus =
  | "active" // Currently active threat
  | "mitigated" // Threat has been addressed
  | "investigating" // Under investigation
  | "false_positive" // Marked as false positive
  | "resolved"; // Fully resolved

/**
 * Threat type categories
 */
export type ThreatType =
  | "phishing" // Phishing attempt detected
  | "malware" // Malicious code/download
  | "data_exfiltration" // Sensitive data being sent out
  | "credential_theft" // Credential harvesting attempt
  | "suspicious_redirect" // Suspicious URL redirect
  | "cryptojacking" // Crypto mining script
  | "xss_attempt" // Cross-site scripting
  | "clickjacking" // UI redressing attack
  | "session_hijack" // Session takeover attempt
  | "unauthorized_access" // Unauthorized resource access
  | "policy_violation" // Security policy breach
  | "anomalous_behavior"; // Unusual activity pattern

/**
 * Detection source
 */
export type DetectionSource =
  | "nrd_detector" // NRD detection
  | "typosquat_detector" // Typosquat detection
  | "threat_intel" // Threat intelligence feed
  | "csp_monitor" // CSP violation monitor
  | "behavior_analysis" // Behavioral analysis
  | "ai_monitor" // AI prompt monitoring
  | "extension_monitor" // Extension activity
  | "network_monitor" // Network traffic analysis
  | "policy_engine"; // Policy engine

/**
 * Runtime threat event
 */
export interface RuntimeThreat {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  status: ThreatStatus;
  source: DetectionSource;
  timestamp: number;
  domain: string;
  url?: string;
  title: string;
  description: string;
  indicators: ThreatIndicator[];
  context: ThreatContext;
  mitigationActions: MitigationAction[];
  timeline: ThreatEvent[];
  relatedThreats: string[];
  assignee?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  notes: string[];
}

/**
 * Threat indicator
 */
export interface ThreatIndicator {
  type: "domain" | "url" | "ip" | "hash" | "pattern" | "behavior";
  value: string;
  confidence: number;
  source: string;
}

/**
 * Threat context
 */
export interface ThreatContext {
  userAction?: string;
  referrer?: string;
  tabId?: number;
  extensionId?: string;
  requestDetails?: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  };
  affectedData?: string[];
  riskFactors: string[];
}

/**
 * Mitigation action
 */
export interface MitigationAction {
  id: string;
  type: MitigationActionType;
  status: "pending" | "in_progress" | "completed" | "failed";
  description: string;
  timestamp: number;
  result?: string;
}

/**
 * Mitigation action types
 */
export type MitigationActionType =
  | "block_domain" // Block the domain
  | "close_tab" // Close the affected tab
  | "clear_cookies" // Clear cookies for domain
  | "notify_user" // Send user notification
  | "log_incident" // Log to incident system
  | "quarantine" // Quarantine the resource
  | "report_threat" // Report to threat intel
  | "manual_review"; // Flag for manual review

/**
 * Threat timeline event
 */
export interface ThreatEvent {
  timestamp: number;
  event: string;
  actor: string;
  details?: Record<string, unknown>;
}

/**
 * Incident for tracking
 */
export interface SecurityIncident {
  id: string;
  title: string;
  severity: ThreatSeverity;
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
  threats: string[];
  createdAt: number;
  updatedAt: number;
  summary: string;
  impact: string;
  rootCause?: string;
  remediation?: string;
  timeline: IncidentEvent[];
  assignee?: string;
  tags: string[];
}

/**
 * Incident timeline event
 */
export interface IncidentEvent {
  timestamp: number;
  type: "created" | "updated" | "escalated" | "contained" | "resolved" | "note";
  actor: string;
  description: string;
}

/**
 * Runtime protection config
 */
export interface RuntimeProtectionConfig {
  enabled: boolean;
  autoMitigate: boolean;
  alertThreshold: ThreatSeverity;
  blockHighRiskDomains: boolean;
  monitorAIPrompts: boolean;
  trackDataFlow: boolean;
  incidentRetentionDays: number;
}

/**
 * Default configuration
 */
export const DEFAULT_RUNTIME_CONFIG: RuntimeProtectionConfig = {
  enabled: true,
  autoMitigate: false,
  alertThreshold: "medium",
  blockHighRiskDomains: false,
  monitorAIPrompts: true,
  trackDataFlow: true,
  incidentRetentionDays: 30,
};

/**
 * Threat detection rule
 */
export interface ThreatDetectionRule {
  id: string;
  name: string;
  enabled: boolean;
  type: ThreatType;
  severity: ThreatSeverity;
  conditions: ThreatCondition[];
  actions: MitigationActionType[];
}

/**
 * Threat condition
 */
export interface ThreatCondition {
  field: string;
  operator: "equals" | "contains" | "matches" | "greater_than" | "less_than";
  value: string | number | boolean;
}

/**
 * Runtime stats
 */
export interface RuntimeStats {
  activeThreats: number;
  threatsToday: number;
  threatsThisWeek: number;
  mitigatedThreats: number;
  openIncidents: number;
  threatsByType: Record<ThreatType, number>;
  threatsBySeverity: Record<ThreatSeverity, number>;
  topThreatDomains: Array<{ domain: string; count: number }>;
  detectionSources: Record<DetectionSource, number>;
}
