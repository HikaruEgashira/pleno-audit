import type { NetworkMonitorConfig } from "@pleno-audit/extension-runtime";
import type { ExtensionStats } from "./extension-network-service-helpers";
import type { ExtensionNetworkService } from "./extension-network-service";

export function createExtensionNetworkAdapter(service: ExtensionNetworkService) {
  return {
    getNetworkMonitorConfig: () => service.getNetworkMonitorConfig(),
    setNetworkMonitorConfig: (config: NetworkMonitorConfig) =>
      service.setNetworkMonitorConfig(config),
    initExtensionMonitor: () => service.initExtensionMonitor(),
    flushNetworkRequestBuffer: () => service.flushNetworkRequestBuffer(),
    checkDNRMatchesHandler: () => service.checkDNRMatchesHandler(),
    analyzeExtensionRisks: () => service.analyzeExtensionRisks(),
    getExtensionRiskAnalysis: (extensionId: string) =>
      service.getExtensionRiskAnalysis(extensionId),
    getAllExtensionRisks: () => service.getAllExtensionRisks(),
    getNetworkRequests: (options?: {
      limit?: number;
      offset?: number;
      since?: number;
      initiatorType?: "extension" | "page" | "browser" | "unknown";
    }) => service.getNetworkRequests(options),
    getExtensionRequests: (options?: { limit?: number; offset?: number }) =>
      service.getExtensionRequests(options),
    getKnownExtensions: () => service.getKnownExtensions(),
    getExtensionStats: (): Promise<ExtensionStats> => service.getExtensionStats(),
  };
}
