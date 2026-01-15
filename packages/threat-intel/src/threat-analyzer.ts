/**
 * @fileoverview Threat Analyzer
 *
 * Analyzes domains against bundled threat intelligence data.
 * All processing is local - no network requests.
 */

import {
  HIGH_RISK_TLDS,
  PHISHING_PATTERNS,
  IMPERSONATION_INDICATORS,
  INFRASTRUCTURE_PATTERNS,
  type ThreatIndicator,
} from "./threat-data.js";

// ============================================================================
// Types
// ============================================================================

export interface ThreatMatch {
  category: "phishing" | "impersonation" | "infrastructure" | "high_risk_tld";
  description: string;
  score: number;
}

export interface ThreatAnalysisResult {
  domain: string;
  threatScore: number;
  riskLevel: "critical" | "high" | "medium" | "low" | "none";
  matches: ThreatMatch[];
  hasHighRiskTLD: boolean;
  timestamp: number;
}

export interface ThreatAnalyzerConfig {
  enabled: boolean;
  minScoreToReport: number;
  checkHighRiskTLDs: boolean;
  checkPhishingPatterns: boolean;
  checkImpersonation: boolean;
  checkInfrastructure: boolean;
}

export const DEFAULT_THREAT_ANALYZER_CONFIG: ThreatAnalyzerConfig = {
  enabled: false, // Disabled by default, requires user consent
  minScoreToReport: 30,
  checkHighRiskTLDs: true,
  checkPhishingPatterns: true,
  checkImpersonation: true,
  checkInfrastructure: true,
};

// ============================================================================
// Analyzer
// ============================================================================

/**
 * Extract TLD from domain
 */
function extractTLD(domain: string): string {
  const parts = domain.toLowerCase().split(".");
  return parts[parts.length - 1] || "";
}

/**
 * Check patterns against domain
 */
function checkPatterns(
  domain: string,
  patterns: ReadonlyArray<ThreatIndicator>,
  category: ThreatMatch["category"]
): ThreatMatch[] {
  const matches: ThreatMatch[] = [];

  for (const indicator of patterns) {
    if (indicator.pattern.test(domain)) {
      matches.push({
        category,
        description: indicator.description,
        score: indicator.score,
      });
    }
  }

  return matches;
}

/**
 * Calculate risk level from score
 */
function scoreToRiskLevel(
  score: number
): ThreatAnalysisResult["riskLevel"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "none";
}

/**
 * Create threat analyzer instance
 */
export function createThreatAnalyzer(
  config: ThreatAnalyzerConfig = DEFAULT_THREAT_ANALYZER_CONFIG
) {
  let currentConfig = { ...config };

  /**
   * Update configuration
   */
  function updateConfig(updates: Partial<ThreatAnalyzerConfig>): void {
    currentConfig = { ...currentConfig, ...updates };
  }

  /**
   * Get current configuration
   */
  function getConfig(): ThreatAnalyzerConfig {
    return { ...currentConfig };
  }

  /**
   * Check if analyzer is enabled
   */
  function isEnabled(): boolean {
    return currentConfig.enabled;
  }

  /**
   * Analyze a domain for threat indicators
   */
  function analyze(domain: string): ThreatAnalysisResult {
    const normalizedDomain = domain.toLowerCase().trim();
    const matches: ThreatMatch[] = [];
    let threatScore = 0;

    // Check high-risk TLD
    const tld = extractTLD(normalizedDomain);
    const hasHighRiskTLD = HIGH_RISK_TLDS.has(tld);

    if (currentConfig.checkHighRiskTLDs && hasHighRiskTLD) {
      matches.push({
        category: "high_risk_tld",
        description: `High-risk TLD: .${tld}`,
        score: 20,
      });
      threatScore += 20;
    }

    // Check phishing patterns
    if (currentConfig.checkPhishingPatterns) {
      const phishingMatches = checkPatterns(
        normalizedDomain,
        PHISHING_PATTERNS,
        "phishing"
      );
      matches.push(...phishingMatches);
      threatScore += phishingMatches.reduce((sum, m) => sum + m.score, 0);
    }

    // Check impersonation indicators
    if (currentConfig.checkImpersonation) {
      const impersonationMatches = checkPatterns(
        normalizedDomain,
        IMPERSONATION_INDICATORS,
        "impersonation"
      );
      matches.push(...impersonationMatches);
      threatScore += impersonationMatches.reduce((sum, m) => sum + m.score, 0);
    }

    // Check infrastructure patterns
    if (currentConfig.checkInfrastructure) {
      const infraMatches = checkPatterns(
        normalizedDomain,
        INFRASTRUCTURE_PATTERNS,
        "infrastructure"
      );
      matches.push(...infraMatches);
      threatScore += infraMatches.reduce((sum, m) => sum + m.score, 0);
    }

    // Cap score at 100
    threatScore = Math.min(threatScore, 100);

    return {
      domain: normalizedDomain,
      threatScore,
      riskLevel: scoreToRiskLevel(threatScore),
      matches,
      hasHighRiskTLD,
      timestamp: Date.now(),
    };
  }

  /**
   * Quick check if domain has any threat indicators
   */
  function hasThreats(domain: string): boolean {
    if (!currentConfig.enabled) return false;
    const result = analyze(domain);
    return result.threatScore >= currentConfig.minScoreToReport;
  }

  /**
   * Batch analyze multiple domains
   */
  function analyzeMultiple(domains: string[]): ThreatAnalysisResult[] {
    return domains.map((domain) => analyze(domain));
  }

  return {
    updateConfig,
    getConfig,
    isEnabled,
    analyze,
    hasThreats,
    analyzeMultiple,
  };
}

export type ThreatAnalyzer = ReturnType<typeof createThreatAnalyzer>;
