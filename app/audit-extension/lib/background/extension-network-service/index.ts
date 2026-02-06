import { createExtensionNetworkState } from "./state";
import type { ExtensionNetworkService, ExtensionNetworkServiceDeps } from "./types";
import { getNetworkRequests, getExtensionRequests } from "./requests";
import {
  getNetworkMonitorConfig,
  initExtensionMonitor,
  setNetworkMonitorConfig,
  flushNetworkRequestBuffer,
  checkDNRMatchesHandler,
  getKnownExtensions,
} from "./monitor";
import {
  analyzeExtensionRisks,
  getAllExtensionRisks,
  getExtensionRiskAnalysis,
} from "./risk-analysis";
import { getExtensionStats } from "./stats";

export type { ExtensionStats } from "../extension-network-service-helpers.js";
export type { ExtensionNetworkService, ExtensionNetworkServiceDeps } from "./types";

export function createExtensionNetworkService(
  deps: ExtensionNetworkServiceDeps
): ExtensionNetworkService {
  const context = {
    deps,
    state: createExtensionNetworkState(),
  };

  return {
    getNetworkMonitorConfig: () => getNetworkMonitorConfig(context),
    setNetworkMonitorConfig: (config) => setNetworkMonitorConfig(context, config),
    initExtensionMonitor: () => initExtensionMonitor(context),
    flushNetworkRequestBuffer: () => flushNetworkRequestBuffer(context),
    checkDNRMatchesHandler: () => checkDNRMatchesHandler(context),
    getNetworkRequests: (options) => getNetworkRequests(context, options),
    getExtensionRequests: (options) => getExtensionRequests(context, options),
    getKnownExtensions: () => getKnownExtensions(context),
    getExtensionStats: () => getExtensionStats(context),
    analyzeExtensionRisks: () => analyzeExtensionRisks(context),
    getExtensionRiskAnalysis: (extensionId) => getExtensionRiskAnalysis(context, extensionId),
    getAllExtensionRisks: () => getAllExtensionRisks(context),
  };
}
