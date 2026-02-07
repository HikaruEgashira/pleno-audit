import type { ExtensionStats } from "../extension-network-service";
import {
  createExtensionNetworkService,
  type ExtensionNetworkService,
  type ExtensionNetworkServiceDeps,
} from "../extension-network-service";

interface ExtensionNetworkGatewayParams {
  deps: ExtensionNetworkServiceDeps;
}

export function createExtensionNetworkGateway(params: ExtensionNetworkGatewayParams) {
  const extensionNetworkService = createExtensionNetworkService(params.deps);

  return {
    service: extensionNetworkService,
    getNetworkMonitorConfig: () => extensionNetworkService.getNetworkMonitorConfig(),
    setNetworkMonitorConfig: (config: Parameters<ExtensionNetworkService["setNetworkMonitorConfig"]>[0]) =>
      extensionNetworkService.setNetworkMonitorConfig(config),
    initExtensionMonitor: () => extensionNetworkService.initExtensionMonitor(),
    flushNetworkRequestBuffer: () => extensionNetworkService.flushNetworkRequestBuffer(),
    checkDNRMatchesHandler: () => extensionNetworkService.checkDNRMatchesHandler(),
    analyzeExtensionRisks: () => extensionNetworkService.analyzeExtensionRisks(),
    getExtensionRiskAnalysis: (extensionId: string) => extensionNetworkService.getExtensionRiskAnalysis(extensionId),
    getAllExtensionRisks: () => extensionNetworkService.getAllExtensionRisks(),
    getNetworkRequests: (options?: Parameters<ExtensionNetworkService["getNetworkRequests"]>[0]) =>
      extensionNetworkService.getNetworkRequests(options),
    getExtensionRequests: (options?: Parameters<ExtensionNetworkService["getExtensionRequests"]>[0]) =>
      extensionNetworkService.getExtensionRequests(options),
    getKnownExtensions: () => extensionNetworkService.getKnownExtensions(),
    getExtensionStats: (): Promise<ExtensionStats> => extensionNetworkService.getExtensionStats(),
  };
}

export type ExtensionNetworkGateway = ReturnType<typeof createExtensionNetworkGateway>;
