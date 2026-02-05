import type {
  AIMonitorConfig,
  CapturedAIPrompt,
  NRDConfig,
  TyposquatConfig,
} from "@pleno-audit/detectors";
import type {
  CSPConfig,
  CSPGenerationOptions,
  CSPViolation,
  NetworkRequest,
} from "@pleno-audit/csp";
import type {
  BlockingConfig,
  ConnectionMode,
  DataRetentionConfig,
  DetectionConfig,
  DoHMonitorConfig,
  EnterpriseStatus,
  NetworkMonitorConfig,
  NotificationConfig,
} from "@pleno-audit/extension-runtime";
import type {
  ParquetEvent,
  ParquetStore,
} from "@pleno-audit/parquet-storage";

export type RuntimeMessage = {
  type?: string;
  data?: unknown;
  payload?: unknown;
  debugType?: string;
  debugData?: unknown;
};

export type RuntimeMessageHandler = (
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean;

export interface AsyncMessageHandlerConfig {
  execute: (
    message: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown>;
  fallback: () => unknown;
}

export interface RuntimeMessageHandlers {
  direct: Map<string, RuntimeMessageHandler>;
  async: Map<string, AsyncMessageHandlerConfig>;
}

type ParquetEventQueryOptions = Parameters<ParquetStore["getEvents"]>[0];
type AsyncHandlerEntry = [string, AsyncMessageHandlerConfig];

interface LoggerLike {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface RuntimeHandlerFallbacks {
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
  aiMonitorConfig: AIMonitorConfig;
  nrdConfig: NRDConfig;
  typosquatConfig: TyposquatConfig;
  networkMonitorConfig: NetworkMonitorConfig;
  dataRetentionConfig: DataRetentionConfig;
  blockingConfig: BlockingConfig;
  notificationConfig: NotificationConfig;
  doHMonitorConfig: DoHMonitorConfig;
}

export interface RuntimeHandlerDependencies {
  logger: LoggerLike;
  fallbacks: RuntimeHandlerFallbacks;

  handleDebugBridgeForward: (
    type: string,
    data: unknown,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  getKnownExtensions: () => Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }>;

  handlePageAnalysis: (payload: unknown) => Promise<void>;
  handleCSPViolation: (
    data: Omit<CSPViolation, "type">,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown>;
  handleNetworkRequest: (
    data: Omit<NetworkRequest, "type">,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown>;
  handleDataExfiltration: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleCredentialTheft: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSupplyChainRisk: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleTrackingBeacon: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleClipboardHijack: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleCookieAccess: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleXSSDetected: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleDOMScraping: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;
  handleSuspiciousDownload: (data: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>;

  getCSPReports: (options?: {
    type?: "csp-violation" | "network-request";
    limit?: number;
    offset?: number;
    since?: string;
    until?: string;
  }) => Promise<unknown>;
  generateCSPPolicy: (options?: Partial<CSPGenerationOptions>) => Promise<unknown>;
  generateCSPPolicyByDomain: (options?: Partial<CSPGenerationOptions>) => Promise<unknown>;
  saveGeneratedCSPPolicy: (result: unknown) => Promise<void>;
  getCSPConfig: () => Promise<CSPConfig>;
  setCSPConfig: (config: Partial<CSPConfig>) => Promise<{ success: boolean }>;
  clearCSPData: () => Promise<{ success: boolean }>;
  clearAllData: () => Promise<{ success: boolean }>;

  getStats: () => Promise<unknown>;

  getConnectionConfig: () => Promise<{ mode: ConnectionMode; endpoint: string | null }>;
  setConnectionConfig: (mode: ConnectionMode, endpoint?: string) => Promise<{ success: boolean }>;
  getSyncConfig: () => Promise<{ enabled: boolean; endpoint: string | null }>;
  setSyncConfig: (enabled: boolean, endpoint?: string) => Promise<{ success: boolean }>;
  triggerSync: () => Promise<{ success: boolean; sent: number; received: number }>;

  getSSOManager: () => Promise<{
    getStatus: () => Promise<unknown>;
    disableSSO: () => Promise<void>;
    startOIDCAuth: () => Promise<unknown>;
    startSAMLAuth: () => Promise<unknown>;
  }>;
  getEnterpriseManager: () => Promise<{
    getStatus: () => EnterpriseStatus;
    getEffectiveDetectionConfig: (config: DetectionConfig) => DetectionConfig;
  }>;

  getDetectionConfig: () => Promise<DetectionConfig>;
  setDetectionConfig: (config: Partial<DetectionConfig>) => Promise<{ success: boolean }>;

  handleAIPromptCaptured: (data: CapturedAIPrompt) => Promise<{ success: boolean }>;
  getAIPrompts: () => Promise<CapturedAIPrompt[]>;
  getAIPromptsCount: () => Promise<number>;
  getAIMonitorConfig: () => Promise<AIMonitorConfig>;
  setAIMonitorConfig: (config: Partial<AIMonitorConfig>) => Promise<{ success: boolean }>;
  clearAIData: () => Promise<{ success: boolean }>;

  handleNRDCheck: (domain: string) => Promise<unknown>;
  getNRDConfig: () => Promise<NRDConfig>;
  setNRDConfig: (config: NRDConfig) => Promise<{ success: boolean }>;

  handleTyposquatCheck: (domain: string) => Promise<unknown>;
  getTyposquatConfig: () => Promise<TyposquatConfig>;
  setTyposquatConfig: (config: TyposquatConfig) => Promise<{ success: boolean }>;

  getOrInitParquetStore: () => Promise<ParquetStore>;

  getNetworkRequests: (options?: {
    limit?: number;
    offset?: number;
    since?: number;
    initiatorType?: "extension" | "page" | "browser" | "unknown";
  }) => Promise<unknown>;
  getExtensionRequests: (options?: { limit?: number; offset?: number }) => Promise<unknown>;
  getExtensionStats: () => Promise<unknown>;
  getNetworkMonitorConfig: () => Promise<NetworkMonitorConfig>;
  setNetworkMonitorConfig: (config: NetworkMonitorConfig) => Promise<{ success: boolean }>;
  getAllExtensionRisks: () => Promise<unknown[]>;
  getExtensionRiskAnalysis: (extensionId: string) => Promise<unknown>;
  analyzeExtensionRisks: () => Promise<void>;

  getDataRetentionConfig: () => Promise<DataRetentionConfig>;
  setDataRetentionConfig: (config: DataRetentionConfig) => Promise<{ success: boolean }>;
  cleanupOldData: () => Promise<{ deleted: number }>;

  getBlockingConfig: () => Promise<BlockingConfig>;
  setBlockingConfig: (config: BlockingConfig) => Promise<{ success: boolean }>;

  getNotificationConfig: () => Promise<NotificationConfig>;
  setNotificationConfig: (
    config: Partial<NotificationConfig>,
  ) => Promise<{ success: boolean }>;

  getDoHMonitorConfig: () => Promise<DoHMonitorConfig>;
  setDoHMonitorConfig: (
    config: Partial<DoHMonitorConfig>,
  ) => Promise<{ success: boolean }>;
  getDoHRequests: (options?: {
    limit?: number;
    offset?: number;
  }) => Promise<unknown>;
}

export function runAsyncMessageHandler(
  logger: LoggerLike,
  config: AsyncMessageHandlerConfig,
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): true {
  config.execute(message, sender)
    .then(sendResponse)
    .catch((error) => {
      logger.error("Async message handler failed", {
        type: message.type,
        senderTabId: sender.tab?.id,
        senderUrl: sender.tab?.url,
        error: error instanceof Error ? error.message : String(error),
      });
      sendResponse(config.fallback());
    });
  return true;
}

function normalizeEventQueryOptions(data: unknown): Record<string, unknown> {
  const options = typeof data === "object" && data !== null
    ? { ...(data as Record<string, unknown>) }
    : {};

  if (typeof options.since === "number") {
    options.since = new Date(options.since).toISOString();
  }
  if (typeof options.until === "number") {
    options.until = new Date(options.until).toISOString();
  }

  return options;
}

function parseEventDetails(details: unknown): unknown {
  return typeof details === "string" ? JSON.parse(details) : details;
}

function createDirectHandlers(
  deps: RuntimeHandlerDependencies,
): Map<string, RuntimeMessageHandler> {
  return new Map<string, RuntimeMessageHandler>([
    ["PING", (_message, _sender, sendResponse) => {
      sendResponse("PONG");
      return false;
    }],
    ["LOCAL_API_REQUEST", () => false],
    ["OFFSCREEN_READY", () => false],
    ["DEBUG_BRIDGE_CONNECTED", () => {
      deps.logger.debug("Debug bridge: connected");
      return false;
    }],
    ["DEBUG_BRIDGE_DISCONNECTED", () => {
      deps.logger.debug("Debug bridge: disconnected");
      return false;
    }],
    ["DEBUG_BRIDGE_FORWARD", (message, _sender, sendResponse) => {
      deps.handleDebugBridgeForward(message.debugType as string, message.debugData)
        .then(sendResponse)
        .catch((error) => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      return true;
    }],
    ["GET_GENERATED_CSP_POLICY", (_message, _sender, sendResponse) => {
      chrome.storage.local.get("generatedCSPPolicy", (data) => {
        sendResponse(data.generatedCSPPolicy || null);
      });
      return true;
    }],
    ["START_SSO_AUTH", (message, _sender, sendResponse) => {
      (async () => {
        try {
          const ssoManager = await deps.getSSOManager();
          const provider = (message.data as { provider?: string } | undefined)?.provider;
          if (provider === "oidc") {
            const session = await ssoManager.startOIDCAuth();
            sendResponse({ success: true, session });
            return;
          }
          if (provider === "saml") {
            const session = await ssoManager.startSAMLAuth();
            sendResponse({ success: true, session });
            return;
          }
          sendResponse({ success: false, error: "Unknown provider" });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Auth failed",
          });
        }
      })();
      return true;
    }],
    ["GET_KNOWN_EXTENSIONS", (_message, _sender, sendResponse) => {
      sendResponse(deps.getKnownExtensions());
      return false;
    }],
  ]);
}

function createSecurityEventHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["PAGE_ANALYZED", {
      execute: async (message) => {
        await deps.handlePageAnalysis(message.payload);
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
    ["CSP_VIOLATION", {
      execute: (message, sender) => deps.handleCSPViolation(message.data as Omit<CSPViolation, "type">, sender),
      fallback: () => ({ success: false }),
    }],
    ["NETWORK_REQUEST", {
      execute: (message, sender) => deps.handleNetworkRequest(message.data as Omit<NetworkRequest, "type">, sender),
      fallback: () => ({ success: false }),
    }],
    ["DATA_EXFILTRATION_DETECTED", {
      execute: (message, sender) => deps.handleDataExfiltration(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CREDENTIAL_THEFT_DETECTED", {
      execute: (message, sender) => deps.handleCredentialTheft(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["SUPPLY_CHAIN_RISK_DETECTED", {
      execute: (message, sender) => deps.handleSupplyChainRisk(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["TRACKING_BEACON_DETECTED", {
      execute: (message, sender) => deps.handleTrackingBeacon(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["CLIPBOARD_HIJACK_DETECTED", {
      execute: (message, sender) => deps.handleClipboardHijack(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["COOKIE_ACCESS_DETECTED", {
      execute: (message, sender) => deps.handleCookieAccess(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["XSS_DETECTED", {
      execute: (message, sender) => deps.handleXSSDetected(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["DOM_SCRAPING_DETECTED", {
      execute: (message, sender) => deps.handleDOMScraping(message.data, sender),
      fallback: () => ({ success: false }),
    }],
    ["SUSPICIOUS_DOWNLOAD_DETECTED", {
      execute: (message, sender) => deps.handleSuspiciousDownload(message.data, sender),
      fallback: () => ({ success: false }),
    }],
  ];
}

function createCspHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_CSP_REPORTS", {
      execute: (message) => deps.getCSPReports(message.data as {
        type?: "csp-violation" | "network-request";
        limit?: number;
        offset?: number;
        since?: string;
        until?: string;
      }),
      fallback: () => [],
    }],
    ["GENERATE_CSP", {
      execute: (message) => deps.generateCSPPolicy((message.data as { options?: Partial<CSPGenerationOptions> } | undefined)?.options),
      fallback: () => null,
    }],
    ["GENERATE_CSP_BY_DOMAIN", {
      execute: (message) => deps.generateCSPPolicyByDomain((message.data as { options?: Partial<CSPGenerationOptions> } | undefined)?.options),
      fallback: () => null,
    }],
    ["REGENERATE_CSP_POLICY", {
      execute: async (message) => {
        const options = (message.data as { options?: Partial<CSPGenerationOptions> } | undefined)?.options
          || { strictMode: false, includeReportUri: true };
        const result = await deps.generateCSPPolicyByDomain(options);
        await deps.saveGeneratedCSPPolicy(result);
        return result;
      },
      fallback: () => null,
    }],
    ["GET_CSP_CONFIG", {
      execute: () => deps.getCSPConfig(),
      fallback: () => deps.fallbacks.cspConfig,
    }],
    ["SET_CSP_CONFIG", {
      execute: (message) => deps.setCSPConfig(message.data as Partial<CSPConfig>),
      fallback: () => ({ success: false }),
    }],
    ["CLEAR_CSP_DATA", {
      execute: () => deps.clearCSPData(),
      fallback: () => ({ success: false }),
    }],
    ["CLEAR_ALL_DATA", {
      execute: () => deps.clearAllData(),
      fallback: () => ({ success: false }),
    }],
  ];
}

function createConnectionAndAuthHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_STATS", {
      execute: () => deps.getStats(),
      fallback: () => ({ violations: 0, requests: 0, uniqueDomains: 0 }),
    }],
    ["GET_CONNECTION_CONFIG", {
      execute: () => deps.getConnectionConfig(),
      fallback: () => ({ mode: "local", endpoint: null }),
    }],
    ["SET_CONNECTION_CONFIG", {
      execute: (message) => {
        const data = message.data as { mode: ConnectionMode; endpoint?: string };
        return deps.setConnectionConfig(data.mode, data.endpoint);
      },
      fallback: () => ({ success: false }),
    }],
    ["GET_SYNC_CONFIG", {
      execute: () => deps.getSyncConfig(),
      fallback: () => ({ enabled: false, endpoint: null }),
    }],
    ["SET_SYNC_CONFIG", {
      execute: (message) => {
        const data = message.data as { enabled: boolean; endpoint?: string };
        return deps.setSyncConfig(data.enabled, data.endpoint);
      },
      fallback: () => ({ success: false }),
    }],
    ["TRIGGER_SYNC", {
      execute: () => deps.triggerSync(),
      fallback: () => ({ success: false, sent: 0, received: 0 }),
    }],
    ["GET_SSO_STATUS", {
      execute: async () => {
        const ssoManager = await deps.getSSOManager();
        return ssoManager.getStatus();
      },
      fallback: () => ({ enabled: false, isAuthenticated: false }),
    }],
    ["SET_SSO_ENABLED", {
      execute: async (message) => {
        const ssoManager = await deps.getSSOManager();
        if ((message.data as { enabled?: boolean } | undefined)?.enabled === false) {
          await ssoManager.disableSSO();
        }
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
    ["DISABLE_SSO", {
      execute: async () => {
        const ssoManager = await deps.getSSOManager();
        await ssoManager.disableSSO();
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
    ["GET_ENTERPRISE_STATUS", {
      execute: async () => {
        const enterpriseManager = await deps.getEnterpriseManager();
        return enterpriseManager.getStatus();
      },
      fallback: () => ({
        isManaged: false,
        ssoRequired: false,
        settingsLocked: false,
        config: null,
      } as EnterpriseStatus),
    }],
    ["GET_EFFECTIVE_DETECTION_CONFIG", {
      execute: async () => {
        const enterpriseManager = await deps.getEnterpriseManager();
        const userConfig = await deps.getDetectionConfig();
        return enterpriseManager.getEffectiveDetectionConfig(userConfig);
      },
      fallback: () => deps.fallbacks.detectionConfig,
    }],
  ];
}

function createAIPromptHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["AI_PROMPT_CAPTURED", {
      execute: (message) => deps.handleAIPromptCaptured(message.data as CapturedAIPrompt),
      fallback: () => ({ success: false }),
    }],
    ["GET_AI_PROMPTS", {
      execute: () => deps.getAIPrompts(),
      fallback: () => [],
    }],
    ["GET_AI_PROMPTS_COUNT", {
      execute: async () => ({ count: await deps.getAIPromptsCount() }),
      fallback: () => ({ count: 0 }),
    }],
    ["GET_AI_MONITOR_CONFIG", {
      execute: () => deps.getAIMonitorConfig(),
      fallback: () => deps.fallbacks.aiMonitorConfig,
    }],
    ["SET_AI_MONITOR_CONFIG", {
      execute: (message) => deps.setAIMonitorConfig(message.data as Partial<AIMonitorConfig>),
      fallback: () => ({ success: false }),
    }],
    ["CLEAR_AI_DATA", {
      execute: () => deps.clearAIData(),
      fallback: () => ({ success: false }),
    }],
  ];
}

function createDomainRiskHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["CHECK_NRD", {
      execute: (message) => deps.handleNRDCheck((message.data as { domain: string }).domain),
      fallback: () => ({ error: true }),
    }],
    ["GET_NRD_CONFIG", {
      execute: () => deps.getNRDConfig(),
      fallback: () => deps.fallbacks.nrdConfig,
    }],
    ["SET_NRD_CONFIG", {
      execute: (message) => deps.setNRDConfig(message.data as NRDConfig),
      fallback: () => ({ success: false }),
    }],
    ["CHECK_TYPOSQUAT", {
      execute: (message) => deps.handleTyposquatCheck((message.data as { domain: string }).domain),
      fallback: () => ({ error: true }),
    }],
    ["GET_TYPOSQUAT_CONFIG", {
      execute: () => deps.getTyposquatConfig(),
      fallback: () => deps.fallbacks.typosquatConfig,
    }],
    ["SET_TYPOSQUAT_CONFIG", {
      execute: (message) => deps.setTyposquatConfig(message.data as TyposquatConfig),
      fallback: () => ({ success: false }),
    }],
  ];
}

function createEventStoreHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_EVENTS", {
      execute: async (message) => {
        const store = await deps.getOrInitParquetStore();
        const options = normalizeEventQueryOptions(message.data) as ParquetEventQueryOptions;
        const result = await store.getEvents(options);
        const events = result.data.map((event: ParquetEvent) => ({
          ...event,
          details: parseEventDetails(event.details),
          timestamp: new Date(event.timestamp).toISOString(),
        }));
        return { events, total: result.total, hasMore: result.hasMore };
      },
      fallback: () => ({ events: [], total: 0, hasMore: false }),
    }],
    ["GET_EVENTS_COUNT", {
      execute: async (message) => {
        const store = await deps.getOrInitParquetStore();
        const options = normalizeEventQueryOptions(message.data) as ParquetEventQueryOptions;
        const result = await store.getEvents(options);
        return { count: result.total };
      },
      fallback: () => ({ count: 0 }),
    }],
    ["CLEAR_EVENTS", {
      execute: async () => {
        const store = await deps.getOrInitParquetStore();
        await store.clearAll();
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
  ];
}

function createNetworkAndExtensionHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_NETWORK_REQUESTS", {
      execute: (message) => deps.getNetworkRequests(message.data as {
        limit?: number;
        offset?: number;
        since?: number;
        initiatorType?: "extension" | "page" | "browser" | "unknown";
      }),
      fallback: () => ({ requests: [], total: 0 }),
    }],
    ["GET_EXTENSION_REQUESTS", {
      execute: (message) => deps.getExtensionRequests(message.data as { limit?: number; offset?: number }),
      fallback: () => ({ requests: [], total: 0 }),
    }],
    ["GET_EXTENSION_STATS", {
      execute: () => deps.getExtensionStats(),
      fallback: () => ({ byExtension: {}, byDomain: {}, total: 0 }),
    }],
    ["GET_NETWORK_MONITOR_CONFIG", {
      execute: () => deps.getNetworkMonitorConfig(),
      fallback: () => deps.fallbacks.networkMonitorConfig,
    }],
    ["SET_NETWORK_MONITOR_CONFIG", {
      execute: (message) => deps.setNetworkMonitorConfig(message.data as NetworkMonitorConfig),
      fallback: () => ({ success: false }),
    }],
    ["GET_ALL_EXTENSION_RISKS", {
      execute: () => deps.getAllExtensionRisks(),
      fallback: () => [],
    }],
    ["GET_EXTENSION_RISK_ANALYSIS", {
      execute: (message) => deps.getExtensionRiskAnalysis((message.data as { extensionId: string }).extensionId),
      fallback: () => null,
    }],
    ["TRIGGER_EXTENSION_RISK_ANALYSIS", {
      execute: async () => {
        await deps.analyzeExtensionRisks();
        return { success: true };
      },
      fallback: () => ({ success: false }),
    }],
  ];
}

function createConfigurationHandlers(
  deps: RuntimeHandlerDependencies,
): AsyncHandlerEntry[] {
  return [
    ["GET_DATA_RETENTION_CONFIG", {
      execute: () => deps.getDataRetentionConfig(),
      fallback: () => deps.fallbacks.dataRetentionConfig,
    }],
    ["SET_DATA_RETENTION_CONFIG", {
      execute: (message) => deps.setDataRetentionConfig(message.data as DataRetentionConfig),
      fallback: () => ({ success: false }),
    }],
    ["TRIGGER_DATA_CLEANUP", {
      execute: () => deps.cleanupOldData(),
      fallback: () => ({ deleted: 0 }),
    }],
    ["GET_BLOCKING_CONFIG", {
      execute: () => deps.getBlockingConfig(),
      fallback: () => deps.fallbacks.blockingConfig,
    }],
    ["SET_BLOCKING_CONFIG", {
      execute: (message) => deps.setBlockingConfig(message.data as BlockingConfig),
      fallback: () => ({ success: false }),
    }],
    ["GET_DETECTION_CONFIG", {
      execute: () => deps.getDetectionConfig(),
      fallback: () => deps.fallbacks.detectionConfig,
    }],
    ["SET_DETECTION_CONFIG", {
      execute: (message) => deps.setDetectionConfig(message.data as Partial<DetectionConfig>),
      fallback: () => ({ success: false }),
    }],
    ["GET_NOTIFICATION_CONFIG", {
      execute: () => deps.getNotificationConfig(),
      fallback: () => deps.fallbacks.notificationConfig,
    }],
    ["SET_NOTIFICATION_CONFIG", {
      execute: (message) => deps.setNotificationConfig(message.data as Partial<NotificationConfig>),
      fallback: () => ({ success: false }),
    }],
    ["GET_DOH_MONITOR_CONFIG", {
      execute: () => deps.getDoHMonitorConfig(),
      fallback: () => deps.fallbacks.doHMonitorConfig,
    }],
    ["SET_DOH_MONITOR_CONFIG", {
      execute: (message) => deps.setDoHMonitorConfig(message.data as Partial<DoHMonitorConfig>),
      fallback: () => ({ success: false }),
    }],
    ["GET_DOH_REQUESTS", {
      execute: (message) => deps.getDoHRequests(message.data as {
        limit?: number;
        offset?: number;
      }),
      fallback: () => ({ requests: [], total: 0 }),
    }],
  ];
}

function createAsyncHandlers(
  deps: RuntimeHandlerDependencies,
): Map<string, AsyncMessageHandlerConfig> {
  const entries: AsyncHandlerEntry[] = [
    ...createSecurityEventHandlers(deps),
    ...createCspHandlers(deps),
    ...createConnectionAndAuthHandlers(deps),
    ...createAIPromptHandlers(deps),
    ...createDomainRiskHandlers(deps),
    ...createEventStoreHandlers(deps),
    ...createNetworkAndExtensionHandlers(deps),
    ...createConfigurationHandlers(deps),
  ];
  return new Map(entries);
}

export function createRuntimeMessageHandlers(
  deps: RuntimeHandlerDependencies,
): RuntimeMessageHandlers {
  return {
    direct: createDirectHandlers(deps),
    async: createAsyncHandlers(deps),
  };
}
