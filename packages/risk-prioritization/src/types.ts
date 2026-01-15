/**
 * @fileoverview Risk Prioritization Types
 *
 * Wiz-style risk prioritization with context-aware scoring.
 * Focuses remediation efforts on exploitable attack paths.
 */

/**
 * Risk severity levels
 */
export type RiskSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Risk category
 */
export type RiskCategory =
  | "data_exposure" // Sensitive data at risk
  | "credential_theft" // Credential compromise risk
  | "malicious_site" // Known malicious destination
  | "suspicious_domain" // NRD/Typosquat risk
  | "policy_violation" // Security policy breach
  | "excessive_permission" // Over-privileged access
  | "ai_data_leak" // AI service data exposure
  | "extension_risk" // Browser extension risk
  | "unmonitored_service"; // Unclassified/low risk service

/**
 * Risk factor contributing to score
 */
export interface RiskFactor {
  id: string;
  name: string;
  category: RiskCategory;
  weight: number;
  present: boolean;
  description: string;
  evidence?: string[];
}

/**
 * Prioritized risk item
 */
export interface PrioritizedRisk {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  score: number;
  category: RiskCategory;
  domain?: string;
  factors: RiskFactor[];
  attackPath?: string[];
  impact: RiskImpact;
  remediation: RemediationAction[];
  firstSeen: number;
  lastSeen: number;
  status: "open" | "acknowledged" | "mitigated" | "resolved";
}

/**
 * Risk impact assessment
 */
export interface RiskImpact {
  dataAtRisk: string[];
  affectedUsers: "all" | "admin" | "specific" | "none";
  businessImpact: "critical" | "high" | "medium" | "low";
  exploitability: "trivial" | "easy" | "moderate" | "difficult";
}

/**
 * Remediation action
 */
export interface RemediationAction {
  id: string;
  type: RemediationType;
  priority: "immediate" | "short_term" | "long_term";
  description: string;
  automated: boolean;
  status: "pending" | "in_progress" | "completed";
}

/**
 * Remediation types
 */
export type RemediationType =
  | "block_access" // Block the risky resource
  | "revoke_permission" // Remove excessive permissions
  | "enable_monitoring" // Add to monitoring
  | "update_policy" // Update security policy
  | "user_training" // Security awareness
  | "investigate" // Further investigation needed
  | "accept_risk"; // Documented risk acceptance

/**
 * Risk summary for dashboard
 */
export interface RiskSummary {
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topCategories: Array<{ category: RiskCategory; count: number }>;
  riskTrend: RiskTrend;
  averageScore: number;
  remediationProgress: number;
}

/**
 * Risk trend over time
 */
export interface RiskTrend {
  direction: "increasing" | "decreasing" | "stable";
  changePercent: number;
  comparisonPeriod: "day" | "week" | "month";
}

/**
 * Risk scoring weights
 */
export const RISK_WEIGHTS: Record<RiskCategory, number> = {
  credential_theft: 40,
  malicious_site: 35,
  data_exposure: 30,
  suspicious_domain: 25,
  ai_data_leak: 25,
  policy_violation: 20,
  excessive_permission: 15,
  extension_risk: 15,
};

/**
 * Severity thresholds
 */
export const SEVERITY_THRESHOLDS = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
};
