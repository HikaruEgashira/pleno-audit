/**
 * @fileoverview Blocklist Management
 *
 * Manages domain blocklists from various sources for
 * threat detection and filtering.
 */

import type { ThreatCheckResult } from "./types.js";

/**
 * Known malicious domain patterns
 */
const MALICIOUS_PATTERNS = [
  // Cryptocurrency scams
  /^(?:airdrop|claim|reward|bonus|giveaway)[-.].*\.(com|io|xyz|net)$/i,
  // Fake login pages
  /(?:login|signin|secure|verify|update)[-.](?:google|microsoft|apple|amazon|paypal|bank)/i,
  // Phishing patterns
  /^(?:www\.)?(?:secure|login|verify|account|update)[-_].*\.(com|net|org)$/i,
];

/**
 * Known safe domains (never block)
 */
const SAFE_DOMAINS = new Set([
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "microsoft.com",
  "windows.com",
  "apple.com",
  "icloud.com",
  "amazon.com",
  "aws.amazon.com",
  "cloudflare.com",
  "github.com",
  "githubusercontent.com",
  "anthropic.com",
  "openai.com",
]);

/**
 * In-memory blocklist cache
 */
let blocklistCache: Set<string> = new Set();
let blocklistLastUpdated = 0;
const BLOCKLIST_TTL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Check if domain matches malicious patterns
 */
export function checkMaliciousPatterns(domain: string): ThreatCheckResult | null {
  // Skip safe domains
  for (const safe of SAFE_DOMAINS) {
    if (domain === safe || domain.endsWith(`.${safe}`)) {
      return null;
    }
  }

  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(domain)) {
      return {
        indicator: domain,
        type: "domain",
        isThreat: true,
        severity: "medium",
        categories: ["phishing"],
        sources: ["internal"],
        confidence: 60,
        checkedAt: Date.now(),
        cached: false,
      };
    }
  }

  return null;
}

/**
 * Fetch and parse a text-based blocklist
 */
async function fetchTextBlocklist(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "text/plain",
      },
    });

    if (!response.ok) {
      return [];
    }

    const text = await response.text();
    const lines = text.split("\n");
    const domains: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
        continue;
      }

      // Handle different formats
      // Format: domain
      // Format: ip domain
      // Format: 0.0.0.0 domain
      // Format: 127.0.0.1 domain
      const parts = trimmed.split(/\s+/);
      const domain = parts.length > 1 ? parts[1] : parts[0];

      // Validate domain format
      if (domain && /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) {
        domains.push(domain.toLowerCase());
      }
    }

    return domains;
  } catch {
    return [];
  }
}

/**
 * Update blocklist cache from remote sources
 */
export async function updateBlocklists(urls: string[]): Promise<number> {
  const now = Date.now();
  if (now - blocklistLastUpdated < BLOCKLIST_TTL && blocklistCache.size > 0) {
    return blocklistCache.size;
  }

  const allDomains: string[] = [];

  for (const url of urls) {
    const domains = await fetchTextBlocklist(url);
    allDomains.push(...domains);
  }

  // Deduplicate and filter
  blocklistCache = new Set(
    allDomains.filter((d) => {
      // Skip safe domains
      for (const safe of SAFE_DOMAINS) {
        if (d === safe || d.endsWith(`.${safe}`)) {
          return false;
        }
      }
      return true;
    })
  );

  blocklistLastUpdated = now;
  return blocklistCache.size;
}

/**
 * Check domain against blocklist
 */
export function checkBlocklist(domain: string): ThreatCheckResult | null {
  const lowerDomain = domain.toLowerCase();

  // Direct match
  if (blocklistCache.has(lowerDomain)) {
    return {
      indicator: domain,
      type: "domain",
      isThreat: true,
      severity: "high",
      categories: ["malware"],
      sources: ["blocklist"],
      confidence: 80,
      checkedAt: Date.now(),
      cached: true,
    };
  }

  // Check parent domains
  const parts = lowerDomain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (blocklistCache.has(parent)) {
      return {
        indicator: domain,
        type: "domain",
        isThreat: true,
        severity: "high",
        categories: ["malware"],
        sources: ["blocklist"],
        confidence: 75,
        checkedAt: Date.now(),
        cached: true,
      };
    }
  }

  return null;
}

/**
 * Get blocklist stats
 */
export function getBlocklistStats(): { size: number; lastUpdated: number } {
  return {
    size: blocklistCache.size,
    lastUpdated: blocklistLastUpdated,
  };
}

/**
 * Clear blocklist cache
 */
export function clearBlocklistCache(): void {
  blocklistCache.clear();
  blocklistLastUpdated = 0;
}
