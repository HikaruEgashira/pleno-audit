/**
 * @fileoverview Bundled Threat Intelligence Data
 *
 * This file contains static threat intelligence data bundled with the extension.
 * No external network requests are made - all data is local.
 *
 * Data sources (public, open-source):
 * - High-risk TLDs: Based on Spamhaus statistics
 * - Phishing patterns: Common patterns observed in phishing campaigns
 * - Brand impersonation: Generic patterns, not specific brand lists
 *
 * Last updated: 2025-01
 */

// ============================================================================
// High-Risk TLDs
// ============================================================================

/**
 * TLDs with historically high abuse rates
 * Source: Spamhaus statistics, public reports
 */
export const HIGH_RISK_TLDS: ReadonlySet<string> = new Set([
  // Free/cheap TLDs often abused
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  // Other high-abuse TLDs
  "xyz",
  "top",
  "work",
  "click",
  "link",
  "info",
  "online",
  "site",
  "club",
  "icu",
  "buzz",
  "rest",
  "surf",
  "monster",
  "uno",
]);

/**
 * TLDs commonly used for legitimate financial services
 * Lower risk when combined with other factors
 */
export const FINANCIAL_TLDS: ReadonlySet<string> = new Set([
  "bank",
  "insurance",
  "finance",
]);

// ============================================================================
// Suspicious Domain Patterns
// ============================================================================

/**
 * Patterns commonly found in phishing domains
 */
export const PHISHING_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  description: string;
  score: number;
}> = [
  // Login/account related
  {
    pattern: /(?:secure|verify|confirm|update|validate)[_-]?(?:account|login|signin)/i,
    description: "Login verification pattern",
    score: 40,
  },
  {
    pattern: /(?:account|login|signin)[_-]?(?:secure|verify|confirm|update)/i,
    description: "Account security pattern",
    score: 40,
  },
  // Urgency patterns
  {
    pattern: /(?:urgent|immediate|suspended|locked|limited)/i,
    description: "Urgency indicator",
    score: 25,
  },
  // Support/help patterns
  {
    pattern: /(?:support|helpdesk|customer)[_-]?(?:center|service|team)/i,
    description: "Fake support pattern",
    score: 20,
  },
  // Number suffixes (common in bulk phishing)
  {
    pattern: /\d{4,}$/,
    description: "Numeric suffix pattern",
    score: 15,
  },
  // Hyphen abuse
  {
    pattern: /-{2,}/,
    description: "Multiple hyphens",
    score: 20,
  },
  // Long subdomains
  {
    pattern: /^[^.]{30,}\./,
    description: "Very long subdomain",
    score: 25,
  },
];

/**
 * Brand impersonation indicators (generic patterns)
 * Note: We don't maintain a list of specific brands to avoid false positives
 */
export const IMPERSONATION_INDICATORS: ReadonlyArray<{
  pattern: RegExp;
  description: string;
  score: number;
}> = [
  // Common brand-adjacent patterns
  {
    pattern: /(?:^|[.-])(?:official|real|genuine|authentic|original)[.-]/i,
    description: "Authenticity claim in domain",
    score: 35,
  },
  {
    pattern: /(?:^|[.-])(?:my|your|our|the)[.-]?(?:account|portal|login)/i,
    description: "Possessive account pattern",
    score: 25,
  },
  // Security theater
  {
    pattern: /(?:^|[.-])(?:ssl|https|secure|safe|protected)[.-]/i,
    description: "Security claim in domain",
    score: 30,
  },
  // Country/region indicators (often used to bypass filters)
  {
    pattern: /(?:^|[.-])(?:jp|us|uk|eu|asia)[.-]?(?:login|portal|account)/i,
    description: "Region-specific portal pattern",
    score: 20,
  },
];

// ============================================================================
// Malicious Infrastructure Patterns
// ============================================================================

/**
 * Patterns indicating potential malicious infrastructure
 */
export const INFRASTRUCTURE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  description: string;
  score: number;
}> = [
  // Random-looking subdomains (often generated)
  {
    pattern: /^[a-z0-9]{16,}\./i,
    description: "Random alphanumeric subdomain",
    score: 30,
  },
  // IP-like patterns in domain
  {
    pattern: /\d{1,3}[.-]\d{1,3}[.-]\d{1,3}/,
    description: "IP-like pattern in domain",
    score: 25,
  },
  // Base64-like patterns
  {
    pattern: /[a-z0-9+/]{20,}={0,2}/i,
    description: "Base64-like pattern",
    score: 20,
  },
  // UUID-like patterns
  {
    pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
    description: "UUID in domain",
    score: 35,
  },
];

// ============================================================================
// Export Types
// ============================================================================

export interface ThreatIndicator {
  pattern: RegExp;
  description: string;
  score: number;
}

export interface ThreatDataVersion {
  version: string;
  lastUpdated: string;
  totalPatterns: number;
}

export function getThreatDataVersion(): ThreatDataVersion {
  return {
    version: "1.0.0",
    lastUpdated: "2025-01",
    totalPatterns:
      PHISHING_PATTERNS.length +
      IMPERSONATION_INDICATORS.length +
      INFRASTRUCTURE_PATTERNS.length,
  };
}
