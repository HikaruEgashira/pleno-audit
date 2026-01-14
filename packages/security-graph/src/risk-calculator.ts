/**
 * @fileoverview Risk Score Calculator
 *
 * Calculates risk scores for nodes and edges based on
 * multiple factors like NRD, typosquat, CSP violations, etc.
 */

import type { RiskLevel, DataClassification } from "./types.js";

/**
 * Risk factors and their weights
 */
export interface RiskFactors {
  // Domain-based risks
  isNRD?: boolean;
  nrdConfidence?: "high" | "medium" | "low" | "unknown";
  isTyposquat?: boolean;
  typosquatConfidence?: "high" | "medium" | "low" | "none";
  isDDNS?: boolean;

  // Policy-based risks
  hasLogin?: boolean;
  hasPrivacyPolicy?: boolean;
  hasTermsOfService?: boolean;

  // Data flow risks
  dataTypes?: DataClassification[];
  hasCredentials?: boolean;
  hasPII?: boolean;

  // CSP-based risks
  cspViolationCount?: number;

  // Extension-based risks
  extensionRequestCount?: number;

  // AI-based risks
  aiPromptCount?: number;
  aiHasSensitiveData?: boolean;
}

/**
 * Weight configuration for risk calculation
 */
const RISK_WEIGHTS = {
  // Domain risks (0-40 points)
  nrd: {
    high: 35,
    medium: 25,
    low: 15,
    unknown: 10,
  },
  typosquat: {
    high: 40,
    medium: 30,
    low: 20,
    none: 0,
  },
  ddns: 20,

  // Policy risks (0-20 points)
  loginWithoutPolicy: 15,
  noPrivacyPolicy: 10,
  noTermsOfService: 5,

  // Data flow risks (0-30 points)
  dataType: {
    credentials: 30,
    pii: 25,
    financial: 30,
    health: 25,
    code: 15,
    internal: 20,
    unknown: 5,
  },

  // CSP risks (0-20 points)
  cspViolations: {
    base: 2,
    max: 20,
  },

  // Extension risks (0-15 points)
  extensionRequests: {
    threshold: 10,
    score: 15,
  },

  // AI risks (0-25 points)
  aiPrompts: {
    base: 5,
    withSensitiveData: 25,
  },
};

/**
 * Calculate risk score for given factors
 */
export function calculateRiskScore(factors: RiskFactors): number {
  let score = 0;

  // NRD risk
  if (factors.isNRD && factors.nrdConfidence) {
    score += RISK_WEIGHTS.nrd[factors.nrdConfidence] || 0;
  }

  // Typosquat risk
  if (factors.isTyposquat && factors.typosquatConfidence) {
    score += RISK_WEIGHTS.typosquat[factors.typosquatConfidence] || 0;
  }

  // DDNS risk
  if (factors.isDDNS) {
    score += RISK_WEIGHTS.ddns;
  }

  // Policy risks
  if (factors.hasLogin) {
    if (!factors.hasPrivacyPolicy) {
      score += RISK_WEIGHTS.loginWithoutPolicy;
    }
    if (!factors.hasTermsOfService) {
      score += RISK_WEIGHTS.noTermsOfService;
    }
  }

  // Data type risks
  if (factors.dataTypes && factors.dataTypes.length > 0) {
    const maxDataRisk = Math.max(
      ...factors.dataTypes.map((dt) => RISK_WEIGHTS.dataType[dt] || 0)
    );
    score += maxDataRisk;
  }

  // CSP violation risks
  if (factors.cspViolationCount && factors.cspViolationCount > 0) {
    score += Math.min(
      factors.cspViolationCount * RISK_WEIGHTS.cspViolations.base,
      RISK_WEIGHTS.cspViolations.max
    );
  }

  // Extension risks
  if (
    factors.extensionRequestCount &&
    factors.extensionRequestCount > RISK_WEIGHTS.extensionRequests.threshold
  ) {
    score += RISK_WEIGHTS.extensionRequests.score;
  }

  // AI risks
  if (factors.aiPromptCount && factors.aiPromptCount > 0) {
    if (factors.aiHasSensitiveData) {
      score += RISK_WEIGHTS.aiPrompts.withSensitiveData;
    } else {
      score += RISK_WEIGHTS.aiPrompts.base;
    }
  }

  // Normalize to 0-100
  return Math.min(100, Math.max(0, score));
}

/**
 * Convert risk score to risk level
 */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "info";
}

/**
 * Risk level to numeric priority (for sorting)
 */
export function riskLevelPriority(level: RiskLevel): number {
  const priorities: Record<RiskLevel, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };
  return priorities[level];
}

/**
 * Get risk badge color for UI
 */
export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    critical: "#dc2626", // red-600
    high: "#ea580c", // orange-600
    medium: "#ca8a04", // yellow-600
    low: "#16a34a", // green-600
    info: "#6b7280", // gray-500
  };
  return colors[level];
}
