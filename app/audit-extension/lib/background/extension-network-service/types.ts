import type { AlertManager } from "@pleno-audit/alerts";
import type {
  CooldownManager,
  DetectionConfig,
  ExtensionMonitor,
  ExtensionRiskAnalysis,
  NetworkMonitorConfig,
  NetworkRequestRecord,
} from "@pleno-audit/extension-runtime";
import type { ParquetStore } from "@pleno-audit/parquet-storage";
import type { ExtensionStats, NetworkRequestQueryOptions } from "../extension-network-service-helpers.js";

export interface ExtensionNetworkServiceDeps {
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

export interface ExtensionNetworkService {
  getNetworkMonitorConfig: () => Promise<NetworkMonitorConfig>;
  setNetworkMonitorConfig: (config: NetworkMonitorConfig) => Promise<{ success: boolean }>;
  initExtensionMonitor: () => Promise<void>;
  flushNetworkRequestBuffer: () => Promise<void>;
  checkDNRMatchesHandler: () => Promise<void>;
  getNetworkRequests: (
    options?: NetworkRequestQueryOptions
  ) => Promise<{ requests: NetworkRequestRecord[]; total: number }>;
  getExtensionRequests: (
    options?: { limit?: number; offset?: number }
  ) => Promise<{ requests: NetworkRequestRecord[]; total: number }>;
  getKnownExtensions: () => Record<
    string,
    { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }
  >;
  getExtensionStats: () => Promise<ExtensionStats>;
  analyzeExtensionRisks: () => Promise<void>;
  getExtensionRiskAnalysis: (extensionId: string) => Promise<ExtensionRiskAnalysis | null>;
  getAllExtensionRisks: () => Promise<ExtensionRiskAnalysis[]>;
}

export interface ExtensionNetworkState {
  extensionMonitor: ExtensionMonitor | null;
  cooldownManager: CooldownManager | null;
  networkRequestBuffer: NetworkRequestRecord[];
}

export interface LoggerLike {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface ExtensionNetworkContext {
  deps: ExtensionNetworkServiceDeps;
  state: ExtensionNetworkState;
}
