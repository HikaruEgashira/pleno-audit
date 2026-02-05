import {
  analyzeInstalledExtension,
  createCooldownManager,
  createExtensionMonitor,
  createPersistentCooldownStorage,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  type CooldownManager,
  type DetectionConfig,
  type ExtensionMonitor,
  type ExtensionMonitorConfig,
  type ExtensionRiskAnalysis,
  type NetworkMonitorConfig,
  type NetworkRequestRecord,
} from "@pleno-audit/extension-runtime";
import type { AlertManager } from "@pleno-audit/alerts";
import {
  networkRequestRecordToParquetRecord,
  parquetRecordToNetworkRequestRecord,
  type ParquetStore,
} from "@pleno-audit/parquet-storage";

interface LoggerLike {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface ExtensionNetworkServiceDeps {
  logger: LoggerLike;
  getStorage: () => Promise<{
    alertCooldown?: Record<string, number>;
    networkMonitorConfig?: NetworkMonitorConfig;
    detectionConfig?: DetectionConfig;
  }>;
  setStorage: (data: {
    alertCooldown?: Record<string, number>;
    networkMonitorConfig?: NetworkMonitorConfig;
  }) => Promise<void>;
  getOrInitParquetStore: () => Promise<ParquetStore>;
  addEvent: (event: {
    type: "extension_request";
    domain: string;
    timestamp: number;
    details: {
      extensionId: string;
      extensionName: string;
      url: string;
      method: string;
      resourceType: string;
      initiatorType: NetworkRequestRecord["initiatorType"];
    };
  }) => Promise<unknown>;
  getAlertManager: () => AlertManager;
  getRuntimeId: () => string;
}

export interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[] }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

export interface ExtensionNetworkService {
  getNetworkMonitorConfig: () => Promise<NetworkMonitorConfig>;
  setNetworkMonitorConfig: (config: NetworkMonitorConfig) => Promise<{ success: boolean }>;
  initExtensionMonitor: () => Promise<void>;
  flushNetworkRequestBuffer: () => Promise<void>;
  checkDNRMatchesHandler: () => Promise<void>;
  getNetworkRequests: (options?: {
    limit?: number;
    offset?: number;
    since?: number;
    initiatorType?: "extension" | "page" | "browser" | "unknown";
  }) => Promise<{ requests: NetworkRequestRecord[]; total: number }>;
  getExtensionRequests: (options?: { limit?: number; offset?: number }) => Promise<{ requests: NetworkRequestRecord[]; total: number }>;
  getKnownExtensions: () => Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }>;
  getExtensionStats: () => Promise<ExtensionStats>;
  analyzeExtensionRisks: () => Promise<void>;
  getExtensionRiskAnalysis: (extensionId: string) => Promise<ExtensionRiskAnalysis | null>;
  getAllExtensionRisks: () => Promise<ExtensionRiskAnalysis[]>;
}

const EXTENSION_ALERT_COOLDOWN_MS = 1000 * 60 * 60;

type ExtensionAnalysisRequest = Parameters<typeof analyzeInstalledExtension>[1][number];

function mapToExtensionAnalysisRequest(request: NetworkRequestRecord): ExtensionAnalysisRequest {
  return {
    id: request.id,
    extensionId: request.extensionId!,
    extensionName: request.extensionName || "Unknown",
    timestamp: request.timestamp,
    url: request.url,
    method: request.method,
    resourceType: request.resourceType,
    domain: request.domain,
    detectedBy: request.detectedBy,
  };
}

function groupRequestsByExtensionId(requests: NetworkRequestRecord[]): Map<string, NetworkRequestRecord[]> {
  const grouped = new Map<string, NetworkRequestRecord[]>();
  for (const request of requests) {
    if (!request.extensionId) continue;
    const existing = grouped.get(request.extensionId) || [];
    existing.push(request);
    grouped.set(request.extensionId, existing);
  }
  return grouped;
}

export function createExtensionNetworkService(deps: ExtensionNetworkServiceDeps): ExtensionNetworkService {
  let extensionMonitor: ExtensionMonitor | null = null;
  let cooldownManager: CooldownManager | null = null;
  const networkRequestBuffer: NetworkRequestRecord[] = [];

  function getCooldownManager(): CooldownManager {
    if (!cooldownManager) {
      const storage = createPersistentCooldownStorage(
        async () => {
          const data = await deps.getStorage();
          return { alertCooldown: data.alertCooldown };
        },
        async (data) => {
          await deps.setStorage({ alertCooldown: data.alertCooldown });
        },
      );
      cooldownManager = createCooldownManager(storage, {
        defaultCooldownMs: EXTENSION_ALERT_COOLDOWN_MS,
      });
    }
    return cooldownManager;
  }

  async function getNetworkMonitorConfig(): Promise<NetworkMonitorConfig> {
    const storage = await deps.getStorage();
    return storage.networkMonitorConfig || DEFAULT_NETWORK_MONITOR_CONFIG;
  }

  async function getNetworkRequests(options?: {
    limit?: number;
    offset?: number;
    since?: number;
    initiatorType?: "extension" | "page" | "browser" | "unknown";
  }): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
    try {
      const store = await deps.getOrInitParquetStore();
      const allRecords = await store.queryRows("network-requests");

      let filtered = allRecords.map((record) => parquetRecordToNetworkRequestRecord(record));

      if (options?.since != null) {
        filtered = filtered.filter((record) => record.timestamp >= options.since!);
      }
      if (options?.initiatorType) {
        filtered = filtered.filter((record) => record.initiatorType === options.initiatorType);
      }

      filtered.sort((a, b) => b.timestamp - a.timestamp);

      const total = filtered.length;
      const offset = options?.offset || 0;
      const limit = options?.limit || 500;
      const sliced = filtered.slice(offset, offset + limit);

      return { requests: sliced, total };
    } catch (error) {
      deps.logger.error("Failed to query network requests:", error);
      return { requests: [], total: 0 };
    }
  }

  async function getExtensionRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
    return getNetworkRequests({
      limit: options?.limit || 500,
      offset: options?.offset || 0,
      initiatorType: "extension",
    });
  }

  async function getExtensionInitiatedRequests(limit = 10000): Promise<NetworkRequestRecord[]> {
    const result = await getNetworkRequests({ limit, initiatorType: "extension" });
    return result.requests.filter((request) => request.extensionId);
  }

  async function analyzeExtensionRisks(): Promise<void> {
    try {
      const storage = await deps.getStorage();
      const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

      if (!detectionConfig.enableExtension) {
        return;
      }

      const requests = await getExtensionInitiatedRequests();
      if (requests.length === 0) return;

      const manager = getCooldownManager();

      for (const [extensionId, extRequests] of groupRequestsByExtensionId(requests)) {
        const cooldownKey = `extension:${extensionId}`;
        if (await manager.isOnCooldown(cooldownKey)) {
          continue;
        }

        const compatRequests = extRequests.map(mapToExtensionAnalysisRequest);
        const analysis = await analyzeInstalledExtension(extensionId, compatRequests);
        if (!analysis) continue;

        if (analysis.riskLevel === "critical" || analysis.riskLevel === "high") {
          const uniqueDomains = [...new Set(extRequests.map((request) => request.domain))];
          await deps.getAlertManager().alertExtension({
            extensionId: analysis.extensionId,
            extensionName: analysis.extensionName,
            riskLevel: analysis.riskLevel,
            riskScore: analysis.riskScore,
            flags: analysis.flags.map((flag) => flag.flag),
            requestCount: extRequests.length,
            targetDomains: uniqueDomains.slice(0, 10),
          });

          await manager.setCooldown(cooldownKey);
          deps.logger.info(`Extension risk alert fired: ${analysis.extensionName} (score: ${analysis.riskScore})`);
        }
      }
    } catch (error) {
      deps.logger.error("Extension risk analysis failed:", error);
    }
  }

  async function getExtensionRiskAnalysis(extensionId: string): Promise<ExtensionRiskAnalysis | null> {
    const requests = await getExtensionInitiatedRequests();
    const compatRequests = requests
      .filter((request) => request.extensionId === extensionId)
      .map(mapToExtensionAnalysisRequest);

    return analyzeInstalledExtension(extensionId, compatRequests);
  }

  async function getAllExtensionRisks(): Promise<ExtensionRiskAnalysis[]> {
    const requests = await getExtensionInitiatedRequests();
    const requestsByExtension = groupRequestsByExtensionId(requests);

    const results: ExtensionRiskAnalysis[] = [];
    for (const [extensionId, extRequests] of requestsByExtension) {
      const compatRequests = extRequests.map(mapToExtensionAnalysisRequest);
      const analysis = await analyzeInstalledExtension(extensionId, compatRequests);
      if (analysis) {
        results.push(analysis);
      }
    }

    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  function getKnownExtensions(): Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }> {
    if (!extensionMonitor) return {};
    const map = extensionMonitor.getKnownExtensions();
    return Object.fromEntries(map);
  }

  async function getExtensionStats(): Promise<ExtensionStats> {
    const requests = await getExtensionInitiatedRequests();

    const byExtension: Record<string, { name: string; count: number; domains: Set<string> }> = {};
    const byDomain: Record<string, { count: number; extensions: Set<string> }> = {};

    for (const request of requests) {
      if (!request.extensionId) continue;

      if (!byExtension[request.extensionId]) {
        byExtension[request.extensionId] = {
          name: request.extensionName || "Unknown",
          count: 0,
          domains: new Set(),
        };
      }
      byExtension[request.extensionId].count++;
      byExtension[request.extensionId].domains.add(request.domain);

      if (!byDomain[request.domain]) {
        byDomain[request.domain] = { count: 0, extensions: new Set() };
      }
      byDomain[request.domain].count++;
      byDomain[request.domain].extensions.add(request.extensionId);
    }

    const byExtensionResult: ExtensionStats["byExtension"] = {};
    for (const [id, data] of Object.entries(byExtension)) {
      byExtensionResult[id] = {
        name: data.name,
        count: data.count,
        domains: Array.from(data.domains),
      };
    }

    const byDomainResult: ExtensionStats["byDomain"] = {};
    for (const [domain, data] of Object.entries(byDomain)) {
      byDomainResult[domain] = {
        count: data.count,
        extensions: Array.from(data.extensions),
      };
    }

    return { byExtension: byExtensionResult, byDomain: byDomainResult, total: requests.length };
  }

  async function initExtensionMonitor(): Promise<void> {
    if (extensionMonitor) {
      deps.logger.debug("Extension monitor already started");
      return;
    }

    const networkConfig = await getNetworkMonitorConfig();
    if (!networkConfig.enabled) return;

    const config: ExtensionMonitorConfig = {
      enabled: networkConfig.enabled,
      excludeOwnExtension: networkConfig.excludeOwnExtension,
      excludedExtensions: networkConfig.excludedExtensions,
      maxStoredRequests: 10000,
    };

    extensionMonitor = createExtensionMonitor(config, deps.getRuntimeId());

    extensionMonitor.onRequest((record) => {
      networkRequestBuffer.push(record as NetworkRequestRecord);

      void deps.addEvent({
        type: "extension_request",
        domain: record.domain,
        timestamp: record.timestamp,
        details: {
          extensionId: record.extensionId,
          extensionName: record.extensionName,
          url: record.url,
          method: record.method,
          resourceType: record.resourceType,
          initiatorType: (record as NetworkRequestRecord).initiatorType,
        },
      }).catch((error) => {
        deps.logger.error("Failed to add extension request event:", error);
      });
    });

    await extensionMonitor.start();
    deps.logger.info("Extension monitor started");
  }

  async function setNetworkMonitorConfig(newConfig: NetworkMonitorConfig): Promise<{ success: boolean }> {
    try {
      await deps.setStorage({ networkMonitorConfig: newConfig });

      if (extensionMonitor) {
        await extensionMonitor.stop();
        extensionMonitor = null;
      }

      if (newConfig.enabled) {
        await initExtensionMonitor();
      }

      return { success: true };
    } catch (error) {
      deps.logger.error("Error setting network monitor config:", error);
      return { success: false };
    }
  }

  async function flushNetworkRequestBuffer(): Promise<void> {
    if (networkRequestBuffer.length === 0) return;

    const toFlush = networkRequestBuffer.splice(0, networkRequestBuffer.length);
    try {
      const store = await deps.getOrInitParquetStore();
      const records = toFlush.map((record) => networkRequestRecordToParquetRecord(record));
      await store.appendRows("network-requests", records);
    } catch (error) {
      networkRequestBuffer.unshift(...toFlush);
      deps.logger.error("Failed to flush network requests to Parquet:", error);
    }
  }

  async function checkDNRMatchesHandler(): Promise<void> {
    if (!extensionMonitor) return;
    try {
      await extensionMonitor.checkDNRMatches();
    } catch (error) {
      deps.logger.debug("DNR match check failed:", error);
    }
  }

  return {
    getNetworkMonitorConfig,
    setNetworkMonitorConfig,
    initExtensionMonitor,
    flushNetworkRequestBuffer,
    checkDNRMatchesHandler,
    getNetworkRequests,
    getExtensionRequests,
    getKnownExtensions,
    getExtensionStats,
    analyzeExtensionRisks,
    getExtensionRiskAnalysis,
    getAllExtensionRisks,
  };
}
