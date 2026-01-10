/**
 * @service-policy-auditor/nrd
 *
 * NRD (Newly Registered Domain) 検出パッケージ
 * RDAP APIとヒューリスティック分析を組み合わせて、新規登録ドメインを検出
 */

// Types
export type {
  HeuristicScores,
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
} from "./types.js";

export { DEFAULT_NRD_CONFIG } from "./types.js";

// Heuristics
export {
  SUSPICIOUS_TLDS,
  calculateEntropy,
  extractSLD,
  extractTLD,
  hasExcessiveHyphens,
  hasExcessiveNumbers,
  isRandomLooking,
  calculateHeuristics,
  isHighRiskHeuristics,
} from "./heuristics.js";

// RDAP Client
export type { RDAPEvent, RDAPResponse } from "./rdap.js";
export {
  queryRDAP,
  extractRegistrationDate,
  extractDomainStatus,
} from "./rdap.js";

// Detector
export type { NRDCache } from "./detector.js";
export { createNRDDetector } from "./detector.js";
