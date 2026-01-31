/**
 * @fileoverview Trust Algorithm
 *
 * NIST SP 800-207 Zero Trust Architecture Trust Algorithm implementation.
 * Computes trust scores based on CDM signals, identity signals, and policy violations.
 */

/**
 * Trust level classification
 */
export type TrustLevel = "trusted" | "conditional" | "untrusted";

/**
 * Confidence level for detection signals
 */
export type Confidence = "high" | "medium" | "low" | "unknown" | "none";

/**
 * Individual factor contributing to trust score
 */
export interface TrustFactor {
  name: string;
  weight: number;
  score: number;
  reason: string;
}

/**
 * Input signals for trust computation
 */
export interface TrustInput {
  // CDM (Continuous Diagnostics and Mitigation) signals
  isNRD: boolean;
  nrdConfidence: Confidence;
  typosquatConfidence: Confidence;
  cspViolationCount: number;
  extensionRiskScore: number;
  suspiciousPatternCount: number;
  dohDetected: boolean;

  // Identity signals
  isAuthenticated: boolean;
  isEnterpriseManagedDevice: boolean;

  // Policy signals
  policyViolations: number;
}

/**
 * Trust computation result
 */
export interface TrustScore {
  score: number;
  level: TrustLevel;
  factors: TrustFactor[];
}

/**
 * Default trust input (neutral/unknown state)
 */
export const DEFAULT_TRUST_INPUT: TrustInput = {
  isNRD: false,
  nrdConfidence: "unknown",
  typosquatConfidence: "none",
  cspViolationCount: 0,
  extensionRiskScore: 0,
  suspiciousPatternCount: 0,
  dohDetected: false,
  isAuthenticated: false,
  isEnterpriseManagedDevice: false,
  policyViolations: 0,
};

/**
 * Confidence to numeric weight mapping
 */
function confidenceToWeight(confidence: Confidence): number {
  switch (confidence) {
    case "high":
      return 1.0;
    case "medium":
      return 0.7;
    case "low":
      return 0.4;
    case "unknown":
      return 0.1;
    case "none":
      return 0.0;
    default:
      return 0.0;
  }
}

/**
 * Compute trust score from input signals
 *
 * Score ranges:
 * - 80-100: Trusted
 * - 50-79: Conditional
 * - 0-49: Untrusted
 */
export function computeTrustScore(input: TrustInput): TrustScore {
  const factors: TrustFactor[] = [];
  let baseScore = 100;

  // NRD (Newly Registered Domain) factor
  if (input.isNRD) {
    const weight = confidenceToWeight(input.nrdConfidence);
    const deduction = 30 * weight;
    baseScore -= deduction;
    factors.push({
      name: "NRD",
      weight,
      score: -deduction,
      reason: `Newly registered domain (confidence: ${input.nrdConfidence})`,
    });
  }

  // Typosquat factor
  if (input.typosquatConfidence !== "none") {
    const weight = confidenceToWeight(input.typosquatConfidence);
    const deduction = 40 * weight;
    baseScore -= deduction;
    factors.push({
      name: "Typosquat",
      weight,
      score: -deduction,
      reason: `Potential typosquatting detected (confidence: ${input.typosquatConfidence})`,
    });
  }

  // CSP violations factor
  if (input.cspViolationCount > 0) {
    const deduction = Math.min(input.cspViolationCount * 5, 25);
    baseScore -= deduction;
    factors.push({
      name: "CSP Violations",
      weight: 1.0,
      score: -deduction,
      reason: `${input.cspViolationCount} CSP violation(s) detected`,
    });
  }

  // Extension risk factor
  if (input.extensionRiskScore > 0) {
    const deduction = Math.min(input.extensionRiskScore * 0.5, 20);
    baseScore -= deduction;
    factors.push({
      name: "Extension Risk",
      weight: 1.0,
      score: -deduction,
      reason: `Extension risk score: ${input.extensionRiskScore}`,
    });
  }

  // Suspicious patterns factor
  if (input.suspiciousPatternCount > 0) {
    const deduction = Math.min(input.suspiciousPatternCount * 10, 30);
    baseScore -= deduction;
    factors.push({
      name: "Suspicious Patterns",
      weight: 1.0,
      score: -deduction,
      reason: `${input.suspiciousPatternCount} suspicious pattern(s) detected`,
    });
  }

  // DoH detection factor
  if (input.dohDetected) {
    baseScore -= 15;
    factors.push({
      name: "DoH Detected",
      weight: 1.0,
      score: -15,
      reason: "DNS over HTTPS usage detected (potential DNS bypass)",
    });
  }

  // Policy violations factor
  if (input.policyViolations > 0) {
    const deduction = Math.min(input.policyViolations * 15, 45);
    baseScore -= deduction;
    factors.push({
      name: "Policy Violations",
      weight: 1.0,
      score: -deduction,
      reason: `${input.policyViolations} policy violation(s)`,
    });
  }

  // Positive factors (identity signals)
  if (input.isAuthenticated) {
    baseScore += 10;
    factors.push({
      name: "Authenticated",
      weight: 1.0,
      score: 10,
      reason: "User is authenticated",
    });
  }

  if (input.isEnterpriseManagedDevice) {
    baseScore += 15;
    factors.push({
      name: "Enterprise Device",
      weight: 1.0,
      score: 15,
      reason: "Running on enterprise-managed device",
    });
  }

  // Clamp score to 0-100 range
  const score = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine trust level
  let level: TrustLevel;
  if (score >= 80) {
    level = "trusted";
  } else if (score >= 50) {
    level = "conditional";
  } else {
    level = "untrusted";
  }

  return { score, level, factors };
}

/**
 * Create a trust algorithm instance with configuration
 */
export function createTrustAlgorithm(config?: {
  thresholds?: { trusted: number; conditional: number };
}) {
  const thresholds = config?.thresholds ?? { trusted: 80, conditional: 50 };

  return {
    compute(input: TrustInput): TrustScore {
      const result = computeTrustScore(input);

      // Apply custom thresholds
      let level: TrustLevel;
      if (result.score >= thresholds.trusted) {
        level = "trusted";
      } else if (result.score >= thresholds.conditional) {
        level = "conditional";
      } else {
        level = "untrusted";
      }

      return { ...result, level };
    },

    getThresholds() {
      return { ...thresholds };
    },
  };
}

export type TrustAlgorithm = ReturnType<typeof createTrustAlgorithm>;
