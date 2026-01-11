/**
 * NRD (Newly Registered Domain) Detector
 *
 * Main detector that combines suspicious domain analysis with RDAP API queries
 * to provide domain risk assessment.
 *
 * Detection flow:
 * 1. Check cache for previous result
 * 2. Calculate suspicious domain score (synchronous)
 * 3. Query RDAP API for registration date (async, if enabled)
 * 4. Determine final status
 * 5. Cache result for future lookups
 *
 * Note: True NRD detection requires RDAP. Suspicious score analysis
 * detects malicious patterns but not actual domain age.
 */

import type {
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
  SuspiciousDomainScores,
  DDNSInfo,
} from './types.js';
import { calculateSuspiciousScore } from './suspicious.js';
import { queryRDAP, extractRegistrationDate } from './rdap.js';
import { checkDDNS } from './ddns.js';

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
   * Check if a domain is newly registered or suspicious (async)
   *
   * Performs full detection including RDAP API queries if enabled.
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

    // 2. Calculate suspicious domain scores (synchronous, fast)
    const suspiciousScores = calculateSuspiciousScore(domain);

    // 3. Check for DDNS usage (synchronous, fast)
    const ddnsResult = checkDDNS(domain);
    const ddns: DDNSInfo = {
      isDDNS: ddnsResult.isDDNS,
      provider: ddnsResult.provider,
    };

    // 4. Query RDAP API (async, optional - disabled by default)
    let registrationDate: string | null = null;
    let domainAge: number | null = null;
    let method: NRDDetectionMethod = 'suspicious';

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
        // Continue with suspicious score results only
      }
    }

    // 5. Determine final status
    const result = determineNRDStatus(
      domain,
      registrationDate,
      domainAge,
      suspiciousScores,
      ddns,
      config,
      method
    );

    // 6. Cache result for future lookups
    cache.set(domain, result);

    return result;
  }

  /**
   * Check domain using only suspicious score analysis (synchronous)
   *
   * Fast check that doesn't require network access.
   * Detects suspicious patterns but not actual domain age.
   *
   * @param domain - Domain name to check
   * @returns Suspicious domain scores only
   */
  function checkDomainSync(domain: string): SuspiciousDomainScores {
    return calculateSuspiciousScore(domain);
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
 * 1. RDAP verification (highest confidence - true NRD detection)
 * 2. Suspicious domain analysis (medium confidence - pattern-based)
 * 3. Error state (unknown confidence)
 *
 * @param domain - Domain name
 * @param registrationDate - Registration date from RDAP
 * @param domainAge - Calculated domain age
 * @param suspiciousScores - Suspicious domain analysis scores
 * @param ddns - DDNS detection result
 * @param config - NRD configuration
 * @param method - Detection method used
 * @returns Final NRD detection result
 */
function determineNRDStatus(
  domain: string,
  registrationDate: string | null,
  domainAge: number | null,
  suspiciousScores: SuspiciousDomainScores,
  ddns: DDNSInfo,
  config: NRDConfig,
  method: NRDDetectionMethod
): NRDResult {
  let isNRD = false;
  let confidence: NRDConfidence = 'unknown';

  // RDAP result available (highest confidence - true NRD detection)
  if (domainAge !== null) {
    isNRD = domainAge <= config.thresholdDays;
    confidence = 'high';
  }
  // Only suspicious analysis available (medium confidence - pattern-based)
  else if (suspiciousScores.totalScore >= config.suspiciousThreshold) {
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
    suspiciousScores,
    ddns,
    checkedAt: Date.now(),
  };
}
