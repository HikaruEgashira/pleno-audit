/**
 * @fileoverview Threat Intelligence Types
 *
 * Types for integrating external threat intelligence feeds
 * and providing real-time threat data.
 */

/**
 * Threat severity levels
 */
export type ThreatSeverity = "critical" | "high" | "medium" | "low" | "info" | "unknown";

/**
 * Threat categories
 */
export type ThreatCategory =
  | "malware" // Malware distribution
  | "phishing" // Phishing/credential theft
  | "c2" // Command and control
  | "spam" // Spam distribution
  | "botnet" // Botnet infrastructure
  | "cryptominer" // Cryptocurrency mining
  | "ransomware" // Ransomware
  | "apt" // Advanced Persistent Threat
  | "exploit" // Exploit kit
  | "dropper" // Malware dropper
  | "unknown";

/**
 * Threat intelligence source
 */
export type ThreatSource =
  | "urlhaus" // URLhaus by abuse.ch
  | "abuseipdb" // AbuseIPDB
  | "virustotal" // VirusTotal
  | "openphish" // OpenPhish
  | "phishtank" // PhishTank
  | "blocklist" // Various blocklists
  | "internal"; // Internal detection

/**
 * Threat indicator type
 */
export type IndicatorType =
  | "domain"
  | "url"
  | "ip"
  | "hash"
  | "email";

/**
 * Threat indicator result
 */
export interface ThreatIndicator {
  type: IndicatorType;
  value: string;
  isMalicious: boolean;
  severity: ThreatSeverity;
  categories: ThreatCategory[];
  sources: ThreatSourceInfo[];
  firstSeen: number | null;
  lastSeen: number | null;
  confidence: number; // 0-100
  tags: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Source-specific threat info
 */
export interface ThreatSourceInfo {
  source: ThreatSource;
  detected: boolean;
  severity: ThreatSeverity;
  categories: ThreatCategory[];
  reportedAt: number | null;
  url?: string;
  description?: string;
}

/**
 * URLhaus specific response
 */
export interface URLhausResult {
  query_status: "ok" | "no_results" | "invalid_url";
  url_info?: {
    id: string;
    url: string;
    url_status: "online" | "offline" | "unknown";
    host: string;
    date_added: string;
    threat: string;
    tags: string[];
    reporter: string;
  };
}

/**
 * Blocklist entry
 */
export interface BlocklistEntry {
  domain: string;
  category: ThreatCategory;
  source: string;
  addedAt: number;
}

/**
 * Threat check result
 */
export interface ThreatCheckResult {
  indicator: string;
  type: IndicatorType;
  isThreat: boolean;
  severity: ThreatSeverity;
  categories: ThreatCategory[];
  sources: ThreatSource[];
  confidence: number;
  checkedAt: number;
  cached: boolean;
}

/**
 * Threat intel cache entry
 */
export interface ThreatCacheEntry {
  result: ThreatCheckResult;
  expiresAt: number;
}

/**
 * Threat intel configuration
 */
export interface ThreatIntelConfig {
  enabled: boolean;
  cacheTTLMs: number;
  sources: {
    urlhaus: boolean;
    blocklists: boolean;
  };
  blocklists: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_THREAT_INTEL_CONFIG: ThreatIntelConfig = {
  enabled: true,
  cacheTTLMs: 24 * 60 * 60 * 1000, // 24 hours
  sources: {
    urlhaus: true,
    blocklists: true,
  },
  blocklists: [
    "https://urlhaus.abuse.ch/downloads/text/",
  ],
};
