/**
 * @fileoverview Shadow IT Detector
 *
 * Detects unauthorized SaaS and cloud services based on browsing activity.
 */

import type {
  ShadowITConfig,
  DetectedShadowIT,
  ShadowITSummary,
  ServiceCategory,
  SaaSServiceDefinition,
} from "./types.js";
import { KNOWN_SAAS_SERVICES, DEFAULT_SHADOW_IT_CONFIG } from "./types.js";

/**
 * Shadow IT store interface
 */
export interface ShadowITStore {
  getDetectedServices(): Promise<DetectedShadowIT[]>;
  addOrUpdateService(service: DetectedShadowIT): Promise<void>;
  approveService(serviceId: string): Promise<void>;
  removeService(serviceId: string): Promise<void>;
}

/**
 * In-memory shadow IT store
 */
export function createInMemoryShadowITStore(): ShadowITStore {
  const services: Map<string, DetectedShadowIT> = new Map();

  return {
    async getDetectedServices() {
      return Array.from(services.values());
    },

    async addOrUpdateService(service) {
      const existing = services.get(service.serviceId);
      if (existing) {
        services.set(service.serviceId, {
          ...existing,
          lastSeenAt: service.lastSeenAt,
          accessCount: existing.accessCount + 1,
        });
      } else {
        services.set(service.serviceId, service);
      }
    },

    async approveService(serviceId) {
      const service = services.get(serviceId);
      if (service) {
        services.set(serviceId, { ...service, approved: true });
      }
    },

    async removeService(serviceId) {
      services.delete(serviceId);
    },
  };
}

/**
 * Shadow IT detection listener
 */
export type ShadowITListener = (service: DetectedShadowIT, isNew: boolean) => void;

/**
 * Create shadow IT detector
 */
export function createShadowITDetector(
  config: ShadowITConfig = DEFAULT_SHADOW_IT_CONFIG,
  store?: ShadowITStore
) {
  const shadowITStore = store || createInMemoryShadowITStore();
  const listeners: Set<ShadowITListener> = new Set();
  const seenDomains: Set<string> = new Set();

  // Build domain lookup map
  const domainToService: Map<string, SaaSServiceDefinition> = new Map();
  for (const service of KNOWN_SAAS_SERVICES) {
    for (const domain of service.domains) {
      domainToService.set(domain, service);
    }
  }

  /**
   * Check if a domain matches a known SaaS service
   */
  function matchDomain(domain: string): SaaSServiceDefinition | null {
    // Direct match
    if (domainToService.has(domain)) {
      return domainToService.get(domain)!;
    }

    // Try with www prefix removed
    if (domain.startsWith("www.")) {
      const withoutWww = domain.slice(4);
      if (domainToService.has(withoutWww)) {
        return domainToService.get(withoutWww)!;
      }
    }

    // Try subdomain matching
    const parts = domain.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join(".");
      if (domainToService.has(parentDomain)) {
        return domainToService.get(parentDomain)!;
      }
    }

    return null;
  }

  /**
   * Process a domain visit
   */
  async function processVisit(
    domain: string,
    options?: {
      hasUploadedFiles?: boolean;
      hasEnteredCredentials?: boolean;
      hasSentPII?: boolean;
    }
  ): Promise<DetectedShadowIT | null> {
    if (!config.enabled) return null;

    const service = matchDomain(domain);
    if (!service) return null;

    // Check if category is blocked
    if (config.blockedCategories.includes(service.category)) {
      // Could trigger an alert here
    }

    const isApproved = config.approvedServices.includes(service.id);
    const isNew = !seenDomains.has(domain);
    seenDomains.add(domain);

    const existing = (await shadowITStore.getDetectedServices()).find(
      (s) => s.serviceId === service.id
    );

    const detected: DetectedShadowIT = {
      serviceId: service.id,
      serviceName: service.name,
      domain,
      category: service.category,
      riskLevel: service.riskLevel,
      detectedAt: existing?.detectedAt || Date.now(),
      lastSeenAt: Date.now(),
      accessCount: (existing?.accessCount || 0) + 1,
      users: 1, // Single user in browser extension context
      dataExposure: {
        hasUploadedFiles: options?.hasUploadedFiles || existing?.dataExposure.hasUploadedFiles || false,
        hasEnteredCredentials: options?.hasEnteredCredentials || existing?.dataExposure.hasEnteredCredentials || false,
        hasSentPII: options?.hasSentPII || existing?.dataExposure.hasSentPII || false,
        estimatedDataVolume: estimateDataVolume(existing?.accessCount || 0),
      },
      approved: isApproved,
    };

    await shadowITStore.addOrUpdateService(detected);

    // Notify listeners
    const isNewService = !existing;
    if (config.alertOnNewService && isNewService) {
      for (const listener of listeners) {
        try {
          listener(detected, isNewService);
        } catch {
          // Ignore listener errors
        }
      }
    }

    return detected;
  }

  /**
   * Estimate data volume based on access count
   */
  function estimateDataVolume(accessCount: number): "low" | "medium" | "high" {
    if (accessCount > 100) return "high";
    if (accessCount > 20) return "medium";
    return "low";
  }

  /**
   * Get all detected services
   */
  async function getDetectedServices(): Promise<DetectedShadowIT[]> {
    return shadowITStore.getDetectedServices();
  }

  /**
   * Get summary statistics
   */
  async function getSummary(): Promise<ShadowITSummary> {
    const services = await shadowITStore.getDetectedServices();

    const byCategory: Record<ServiceCategory, number> = {
      storage: 0,
      collaboration: 0,
      development: 0,
      productivity: 0,
      communication: 0,
      ai: 0,
      analytics: 0,
      marketing: 0,
      finance: 0,
      hr: 0,
      security: 0,
      social: 0,
      entertainment: 0,
      other: 0,
    };

    let criticalCount = 0;
    let highCount = 0;
    let approvedCount = 0;

    for (const service of services) {
      byCategory[service.category]++;
      if (service.approved) approvedCount++;
      if (service.riskLevel === "critical") criticalCount++;
      if (service.riskLevel === "high") highCount++;
    }

    // Sort by risk for top risks
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const topRisks = [...services]
      .filter((s) => !s.approved)
      .sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel])
      .slice(0, 5);

    // Recently detected
    const recentlyDetected = [...services]
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .slice(0, 5);

    return {
      totalServices: services.length,
      approvedServices: approvedCount,
      unapprovedServices: services.length - approvedCount,
      criticalRiskServices: criticalCount,
      highRiskServices: highCount,
      byCategory,
      topRisks,
      recentlyDetected,
    };
  }

  /**
   * Approve a service
   */
  async function approveService(serviceId: string): Promise<void> {
    await shadowITStore.approveService(serviceId);
  }

  /**
   * Check if a domain is a known SaaS
   */
  function isKnownSaaS(domain: string): boolean {
    return matchDomain(domain) !== null;
  }

  /**
   * Get service info by domain
   */
  function getServiceByDomain(domain: string): SaaSServiceDefinition | null {
    return matchDomain(domain);
  }

  /**
   * Subscribe to new shadow IT detections
   */
  function subscribe(listener: ShadowITListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    processVisit,
    getDetectedServices,
    getSummary,
    approveService,
    isKnownSaaS,
    getServiceByDomain,
    subscribe,
  };
}

export type ShadowITDetector = ReturnType<typeof createShadowITDetector>;
