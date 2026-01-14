/**
 * @fileoverview Threat Intelligence Package
 *
 * Provides threat intelligence integration for detecting
 * malicious domains, URLs, and other indicators of compromise.
 *
 * Supported sources:
 * - URLhaus by abuse.ch
 * - Blocklists (configurable)
 * - Internal pattern matching
 */

// Types
export type {
  ThreatSeverity,
  ThreatCategory,
  ThreatSource,
  IndicatorType,
  ThreatIndicator,
  ThreatSourceInfo,
  URLhausResult,
  BlocklistEntry,
  ThreatCheckResult,
  ThreatCacheEntry,
  ThreatIntelConfig,
} from "./types.js";

export { DEFAULT_THREAT_INTEL_CONFIG } from "./types.js";

// URLhaus integration
export { checkURLhaus, checkURLhausHost } from "./urlhaus.js";

// Blocklist management
export {
  checkMaliciousPatterns,
  updateBlocklists,
  checkBlocklist,
  getBlocklistStats,
  clearBlocklistCache,
} from "./blocklists.js";

// Main detector
export {
  createThreatDetector,
  createInMemoryCache,
  type ThreatDetector,
  type ThreatIntelCache,
} from "./detector.js";
