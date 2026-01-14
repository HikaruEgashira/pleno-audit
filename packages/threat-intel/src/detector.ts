/**
 * @fileoverview Threat Intelligence Detector
 *
 * Main detector that aggregates results from multiple
 * threat intelligence sources.
 */

import type {
  ThreatCheckResult,
  ThreatIntelConfig,
  ThreatCacheEntry,
  ThreatSeverity,
  ThreatCategory,
  ThreatSource,
} from "./types.js";
import { checkURLhausHost } from "./urlhaus.js";
import { checkBlocklist, checkMaliciousPatterns, updateBlocklists } from "./blocklists.js";

/**
 * Threat intelligence cache
 */
export interface ThreatIntelCache {
  get(key: string): ThreatCacheEntry | undefined;
  set(key: string, entry: ThreatCacheEntry): void;
  delete(key: string): void;
  clear(): void;
}

/**
 * Create in-memory cache
 */
export function createInMemoryCache(): ThreatIntelCache {
  const cache = new Map<string, ThreatCacheEntry>();

  return {
    get(key: string) {
      const entry = cache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return entry;
      }
      if (entry) {
        cache.delete(key);
      }
      return undefined;
    },
    set(key: string, entry: ThreatCacheEntry) {
      cache.set(key, entry);
    },
    delete(key: string) {
      cache.delete(key);
    },
    clear() {
      cache.clear();
    },
  };
}

/**
 * Merge multiple threat check results
 */
function mergeResults(results: (ThreatCheckResult | null)[]): ThreatCheckResult | null {
  const validResults = results.filter((r): r is ThreatCheckResult => r !== null);

  if (validResults.length === 0) {
    return null;
  }

  // Find highest threat
  const threatResults = validResults.filter((r) => r.isThreat);

  if (threatResults.length === 0) {
    // No threats found
    return {
      indicator: validResults[0].indicator,
      type: validResults[0].type,
      isThreat: false,
      severity: "info",
      categories: [],
      sources: [],
      confidence: 0,
      checkedAt: Date.now(),
      cached: false,
    };
  }

  // Merge all threat results
  const severityOrder: ThreatSeverity[] = ["critical", "high", "medium", "low", "info", "unknown"];
  const allCategories = new Set<ThreatCategory>();
  const allSources = new Set<ThreatSource>();
  let maxConfidence = 0;
  let highestSeverity: ThreatSeverity = "unknown";

  for (const result of threatResults) {
    for (const cat of result.categories) allCategories.add(cat);
    for (const src of result.sources) allSources.add(src);
    if (result.confidence > maxConfidence) maxConfidence = result.confidence;
    if (severityOrder.indexOf(result.severity) < severityOrder.indexOf(highestSeverity)) {
      highestSeverity = result.severity;
    }
  }

  return {
    indicator: threatResults[0].indicator,
    type: threatResults[0].type,
    isThreat: true,
    severity: highestSeverity,
    categories: Array.from(allCategories),
    sources: Array.from(allSources),
    confidence: Math.min(100, maxConfidence + (allSources.size - 1) * 5),
    checkedAt: Date.now(),
    cached: false,
  };
}

/**
 * Create threat intelligence detector
 */
export function createThreatDetector(
  config: ThreatIntelConfig = {
    enabled: true,
    cacheTTLMs: 24 * 60 * 60 * 1000,
    sources: {
      urlhaus: true,
      blocklists: true,
    },
    blocklists: ["https://urlhaus.abuse.ch/downloads/text/"],
  },
  cache?: ThreatIntelCache
) {
  const threatCache = cache || createInMemoryCache();

  /**
   * Initialize blocklists
   */
  async function initialize(): Promise<void> {
    if (config.sources.blocklists && config.blocklists.length > 0) {
      await updateBlocklists(config.blocklists);
    }
  }

  /**
   * Check domain for threats
   */
  async function checkDomain(domain: string): Promise<ThreatCheckResult> {
    if (!config.enabled) {
      return {
        indicator: domain,
        type: "domain",
        isThreat: false,
        severity: "info",
        categories: [],
        sources: [],
        confidence: 0,
        checkedAt: Date.now(),
        cached: false,
      };
    }

    // Check cache first
    const cacheKey = `domain:${domain}`;
    const cached = threatCache.get(cacheKey);
    if (cached) {
      return { ...cached.result, cached: true };
    }

    const results: (ThreatCheckResult | null)[] = [];

    // Internal pattern check (always enabled, fast)
    results.push(checkMaliciousPatterns(domain));

    // Blocklist check
    if (config.sources.blocklists) {
      results.push(checkBlocklist(domain));
    }

    // URLhaus check (API call)
    if (config.sources.urlhaus) {
      try {
        const urlhausResult = await checkURLhausHost(domain);
        results.push(urlhausResult);
      } catch {
        // Ignore API errors
      }
    }

    const merged = mergeResults(results);

    const finalResult: ThreatCheckResult = merged || {
      indicator: domain,
      type: "domain",
      isThreat: false,
      severity: "info",
      categories: [],
      sources: [],
      confidence: 0,
      checkedAt: Date.now(),
      cached: false,
    };

    // Cache the result
    threatCache.set(cacheKey, {
      result: finalResult,
      expiresAt: Date.now() + config.cacheTTLMs,
    });

    return finalResult;
  }

  /**
   * Batch check multiple domains
   */
  async function checkDomains(domains: string[]): Promise<Map<string, ThreatCheckResult>> {
    const results = new Map<string, ThreatCheckResult>();

    // Process in parallel, but limit concurrency
    const batchSize = 10;
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((d) => checkDomain(d)));
      for (let j = 0; j < batch.length; j++) {
        results.set(batch[j], batchResults[j]);
      }
    }

    return results;
  }

  /**
   * Get threat summary for multiple domains
   */
  async function getThreatSummary(domains: string[]): Promise<{
    total: number;
    threats: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    categories: Record<ThreatCategory, number>;
  }> {
    const results = await checkDomains(domains);

    const summary = {
      total: domains.length,
      threats: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      categories: {} as Record<ThreatCategory, number>,
    };

    for (const result of results.values()) {
      if (result.isThreat) {
        summary.threats++;
        switch (result.severity) {
          case "critical":
            summary.critical++;
            break;
          case "high":
            summary.high++;
            break;
          case "medium":
            summary.medium++;
            break;
          case "low":
            summary.low++;
            break;
        }
        for (const cat of result.categories) {
          summary.categories[cat] = (summary.categories[cat] || 0) + 1;
        }
      }
    }

    return summary;
  }

  /**
   * Clear threat cache
   */
  function clearCache(): void {
    threatCache.clear();
  }

  return {
    initialize,
    checkDomain,
    checkDomains,
    getThreatSummary,
    clearCache,
  };
}

export type ThreatDetector = ReturnType<typeof createThreatDetector>;
