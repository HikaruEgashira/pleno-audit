/**
 * NRD (Newly Registered Domain) Detector
 *
 * Main detector that combines heuristic analysis with RDAP API queries
 * to determine if a domain is newly registered.
 *
 * Detection flow:
 * 1. Check cache for previous result
 * 2. Calculate heuristic score (synchronous)
 * 3. Query RDAP API for registration date (async)
 * 4. Determine final NRD status
 * 5. Cache result for future lookups
 */

import type {
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
  HeuristicScores,
} from './types.js';
import { calculateHeuristics } from './heuristics.js';
import { queryRDAP, extractRegistrationDate } from './rdap.js';

/**
 * Cache interface for storing NRD results
 */
export interface NRDCache {
  get(domain: string): NRDResult | null;
  set(domain: string, result: NRDResult): void;
  clear(): void;
}

/**
 * Create an NRD detector instance
 *
 * @param config - NRD detection configuration
 * @param cache - Cache implementation for storing results
 * @returns Detector object with check methods
 */
export function createNRDDetector(config: NRDConfig, cache: NRDCache) {
  /**
   * Check if a domain is newly registered (async)
   *
   * Performs full detection including RDAP API queries.
   * Results are cached for future lookups.
   *
   * @param domain - Domain name to check
   * @returns NRD detection result
   */
  async function checkDomain(domain: string): Promise<NRDResult> {
    // 1. Check cache for recent result
    const cached = cache.get(domain);
    if (cached && Date.now() - cached.checkedAt < config.cacheExpiry) {
      return { ...cached, method: 'cache' };
    }

    // 2. Calculate heuristic scores (synchronous, fast)
    const heuristics = calculateHeuristics(domain);

    // 3. Query RDAP API (async, optional)
    let registrationDate: string | null = null;
    let domainAge: number | null = null;
    let method: NRDDetectionMethod = 'heuristic';

    if (config.enableRDAP) {
      try {
        const rdapResult = await queryRDAP(domain, config.rdapTimeout);
        registrationDate = extractRegistrationDate(rdapResult);
        if (registrationDate) {
          domainAge = calculateDomainAge(registrationDate);
          method = 'rdap';
        }
      } catch (error) {
        console.warn('[NRD] RDAP query failed:', error);
        // Continue with heuristic results only
      }
    }

    // 4. Determine final NRD status
    const result = determineNRDStatus(
      domain,
      registrationDate,
      domainAge,
      heuristics,
      config,
      method
    );

    // 5. Cache result for future lookups
    cache.set(domain, result);

    return result;
  }

  /**
   * Check domain using only heuristics (synchronous)
   *
   * Fast check that doesn't require network access.
   * Useful for filtering before expensive RDAP queries.
   *
   * @param domain - Domain name to check
   * @returns Heuristic scores only
   */
  function checkDomainSync(domain: string): HeuristicScores {
    return calculateHeuristics(domain);
  }

  return {
    checkDomain,
    checkDomainSync,
  };
}

/**
 * Calculate domain age in days from registration date
 *
 * @param registrationDate - ISO 8601 formatted date string
 * @returns Age in days
 */
function calculateDomainAge(registrationDate: string): number {
  const regDate = new Date(registrationDate);
  const now = new Date();
  const ageMs = now.getTime() - regDate.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine final NRD status based on all available information
 *
 * Priority:
 * 1. RDAP verification (highest confidence)
 * 2. Heuristic analysis (medium confidence)
 * 3. Error state (unknown confidence)
 *
 * @param domain - Domain name
 * @param registrationDate - Registration date from RDAP
 * @param domainAge - Calculated domain age
 * @param heuristics - Heuristic analysis scores
 * @param config - NRD configuration
 * @param method - Detection method used
 * @returns Final NRD detection result
 */
function determineNRDStatus(
  domain: string,
  registrationDate: string | null,
  domainAge: number | null,
  heuristics: HeuristicScores,
  config: NRDConfig,
  method: NRDDetectionMethod
): NRDResult {
  let isNRD = false;
  let confidence: NRDConfidence = 'unknown';

  // RDAP result available (highest confidence)
  if (domainAge !== null) {
    isNRD = domainAge <= config.thresholdDays;
    confidence = 'high';
  }
  // Only heuristics available (medium confidence)
  else if (heuristics.totalScore >= config.heuristicThreshold) {
    isNRD = true;
    confidence = 'medium';
  }

  return {
    domain,
    isNRD,
    confidence,
    registrationDate,
    domainAge,
    method,
    heuristics,
    checkedAt: Date.now(),
  };
}
