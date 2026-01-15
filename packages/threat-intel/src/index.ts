/**
 * @fileoverview Pleno Audit Threat Intelligence
 *
 * Lightweight, bundled threat intelligence for local-only security analysis.
 * No external network requests - all data is bundled with the extension.
 */

// Threat Data
export {
  HIGH_RISK_TLDS,
  FINANCIAL_TLDS,
  PHISHING_PATTERNS,
  IMPERSONATION_INDICATORS,
  INFRASTRUCTURE_PATTERNS,
  getThreatDataVersion,
  type ThreatIndicator,
  type ThreatDataVersion,
} from "./threat-data.js";

// Threat Analyzer
export {
  createThreatAnalyzer,
  DEFAULT_THREAT_ANALYZER_CONFIG,
  type ThreatAnalyzer,
  type ThreatAnalyzerConfig,
  type ThreatAnalysisResult,
  type ThreatMatch,
} from "./threat-analyzer.js";
