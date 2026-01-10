/**
 * NRD (Newly Registered Domain) Detection Types
 *
 * Defines types for detecting domains registered within a threshold period,
 * combining RDAP API queries with heuristic analysis.
 */

/**
 * Heuristic score components for NRD detection
 */
export interface HeuristicScores {
  /** Shannon entropy of domain name (0-1) */
  entropy: number;
  /** Whether domain uses suspicious TLD */
  suspiciousTLD: boolean;
  /** Whether domain has excessive hyphens (3+ or malformed) */
  hasExcessiveHyphens: boolean;
  /** Whether domain has excessive numbers (4+ consecutive or 30%+ ratio) */
  hasExcessiveNumbers: boolean;
  /** Whether domain name looks randomly generated */
  isRandomLooking: boolean;
  /** Total heuristic score (0-100) */
  totalScore: number;
}

/**
 * Detection method used for NRD determination
 */
export type NRDDetectionMethod = 'rdap' | 'heuristic' | 'cache' | 'error';

/**
 * Confidence level of NRD detection result
 */
export type NRDConfidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * Result of NRD detection for a domain
 */
export interface NRDResult {
  domain: string;
  /** Whether domain is newly registered (within threshold) */
  isNRD: boolean;
  /** Confidence level of the result */
  confidence: NRDConfidence;
  /** Registration date from RDAP (ISO 8601 format) */
  registrationDate: string | null;
  /** Domain age in days (null if unknown) */
  domainAge: number | null;
  /** Method used to determine result */
  method: NRDDetectionMethod;
  /** Heuristic analysis scores */
  heuristics: HeuristicScores;
  /** Timestamp when this result was generated */
  checkedAt: number;
}

/**
 * NRD detection configuration
 */
export interface NRDConfig {
  /** Whether NRD detection is enabled */
  enabled: boolean;
  /** Threshold in days (domain age <= this is considered NRD) */
  thresholdDays: number;
  /** Whether to enable RDAP API queries */
  enableRDAP: boolean;
  /** Timeout for RDAP queries in milliseconds */
  rdapTimeout: number;
  /** Heuristic score threshold (0-100) to flag as potential NRD */
  heuristicThreshold: number;
  /** Cache expiry time in milliseconds */
  cacheExpiry: number;
}

/**
 * Default NRD configuration
 */
export const DEFAULT_NRD_CONFIG: NRDConfig = {
  enabled: true,
  thresholdDays: 30,
  enableRDAP: true,
  rdapTimeout: 5000,
  heuristicThreshold: 60,
  cacheExpiry: 86400000, // 24 hours
};
