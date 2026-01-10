import type {
  DetectedService,
  EventLog,
  CookieInfo,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  CookieSetDetails,
  CapturedAIPrompt,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  AIMonitorConfig,
  NRDConfig,
  NRDResult,
} from "@service-policy-auditor/detectors";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  DEFAULT_NRD_CONFIG,
  createNRDDetector,
} from "@service-policy-auditor/detectors";
import type {
  CSPViolation,
  NetworkRequest,
  CSPReport,
  CSPConfig,
  CSPViolationDetails,
  NetworkRequestDetails,
  GeneratedCSPPolicy,
  CSPGenerationOptions,
} from "@service-policy-auditor/csp";
import { DEFAULT_CSP_CONFIG, CSPAnalyzer, CSPReporter, type GeneratedCSPByDomain } from "@service-policy-auditor/csp";
import {
  startCookieMonitor,
  onCookieChange,
  getApiClient,
  updateApiClientConfig,
  checkMigrationNeeded,
  migrateToDatabase,
  getSyncManager,
  getStorage,
  setStorage,
  clearAIPrompts,
  type ApiClient,
  type ConnectionMode,
  type SyncManager,
} from "@service-policy-auditor/extension-runtime";

const MAX_EVENTS = 1000;
const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports: CSPReport[];
  cspConfig: CSPConfig;
}

let storageQueue: Promise<void> = Promise.resolve();
let apiClient: ApiClient | null = null;
let syncManager: SyncManager | null = null;

// NRD Detection
const nrdCache: Map<string, NRDResult> = new Map();
let nrdDetector: ReturnType<typeof createNRDDetector> | null = null;

interface NRDCacheAdapter {
  get(domain: string): NRDResult | null;
  set(domain: string, result: NRDResult): void;
  clear(): void;
}

const nrdCacheAdapter: NRDCacheAdapter = {
  get: (domain) => nrdCache.get(domain) ?? null,
  set: (domain, result) => nrdCache.set(domain, result),
  clear: () => nrdCache.clear(),
};

function queueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    storageQueue = storageQueue
      .then(() => operation())
      .then(resolve)
      .catch(reject);
  });
}

async function initStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get([
    "services",
    "events",
    "cspReports",
    "cspConfig",
  ]);
  return {
    services: result.services || {},
    events: result.events || [],
    cspReports: result.cspReports || [],
    cspConfig: result.cspConfig || DEFAULT_CSP_CONFIG,
  };
}

async function saveStorage(data: Partial<StorageData>) {
  await chrome.storage.local.set(data);
}

async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(["services"]);
    const count = Object.keys(result.services || {}).length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#666" });
  } catch (error) {
    console.error("[Service Policy Auditor] Failed to update badge:", error);
  }
}

function generateEventId(): string {
  return crypto.randomUUID();
}

type NewEvent =
  | {
      type: "login_detected";
      domain: string;
      timestamp: number;
      details: LoginDetectedDetails;
    }
  | {
      type: "privacy_policy_found";
      domain: string;
      timestamp: number;
      details: PrivacyPolicyFoundDetails;
    }
  | {
      type: "terms_of_service_found";
      domain: string;
      timestamp: number;
      details: TosFoundDetails;
    }
  | {
      type: "cookie_set";
      domain: string;
      timestamp: number;
      details: CookieSetDetails;
    }
  | {
      type: "csp_violation";
      domain: string;
      timestamp: number;
      details: CSPViolationDetails;
    }
  | {
      type: "network_request";
      domain: string;
      timestamp: number;
      details: NetworkRequestDetails;
    }
  | {
      type: "ai_prompt_sent";
      domain: string;
      timestamp: number;
      details: AIPromptSentDetails;
    }
  | {
      type: "ai_response_received";
      domain: string;
      timestamp: number;
      details: AIResponseReceivedDetails;
    };

async function addEvent(event: NewEvent): Promise<EventLog> {
  return queueStorageOperation(async () => {
    const storage = await initStorage();
    const newEvent = {
      ...event,
      id: generateEventId(),
    } as EventLog;
    storage.events.unshift(newEvent);
    storage.events = storage.events.slice(0, MAX_EVENTS);
    await saveStorage({ events: storage.events });
    await updateBadge();
    return newEvent;
  });
}

// ============================================================================
// NRD Detection
// ============================================================================

async function getNRDConfig(): Promise<NRDConfig> {
  const storage = await getStorage();
  return storage.nrdConfig || DEFAULT_NRD_CONFIG;
}

async function initNRDDetector() {
  const config = await getNRDConfig();
  nrdDetector = createNRDDetector(config, nrdCacheAdapter);
}

async function checkNRD(domain: string): Promise<NRDResult> {
  if (!nrdDetector) {
    await initNRDDetector();
  }
  return nrdDetector!.checkDomain(domain);
}

async function handleNRDCheck(domain: string): Promise<NRDResult> {
  try {
    const result = await checkNRD(domain);

    // Update service with NRD result if it's a positive detection
    if (result.isNRD) {
      await updateService(result.domain, {
        nrdResult: {
          isNRD: result.isNRD,
          confidence: result.confidence,
          domainAge: result.domainAge,
          checkedAt: result.checkedAt,
        },
      });

      // Add event log
      await addEvent({
        type: "nrd_detected",
        domain: result.domain,
        timestamp: Date.now(),
        details: {
          isNRD: result.isNRD,
          confidence: result.confidence,
          registrationDate: result.registrationDate,
          domainAge: result.domainAge,
          method: result.method,
          heuristicScore: result.heuristics.totalScore,
        },
      });
    }

    return result;
  } catch (error) {
    console.error("[Service Policy Auditor] NRD check failed:", error);
    throw error;
  }
}

async function setNRDConfig(newConfig: NRDConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ nrdConfig: newConfig });
    // Reinitialize detector with new config
    await initNRDDetector();
    // Clear cache on config change
    nrdCacheAdapter.clear();
    return { success: true };
  } catch (error) {
    console.error("[Service Policy Auditor] Error setting NRD config:", error);
    return { success: false };
  }
}

function createDefaultService(domain: string): DetectedService {
  return {
    domain,
    detectedAt: Date.now(),
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    cookies: [],
  };
}

async function updateService(domain: string, update: Partial<DetectedService>) {
  return queueStorageOperation(async () => {
    const storage = await initStorage();
    const existing = storage.services[domain] || createDefaultService(domain);

    storage.services[domain] = {
      ...existing,
      ...update,
    };

    await saveStorage({ services: storage.services });
    await updateBadge();
  });
}

async function addCookieToService(domain: string, cookie: CookieInfo) {
  return queueStorageOperation(async () => {
    const storage = await initStorage();

    if (!storage.services[domain]) {
      storage.services[domain] = createDefaultService(domain);
    }

    const service = storage.services[domain];
    const exists = service.cookies.some((c) => c.name === cookie.name);
    if (!exists) {
      service.cookies.push(cookie);
    }

    await saveStorage({ services: storage.services });
    await updateBadge();
  });
}

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectedDetails;
  privacy: {
    found: boolean;
    url: string | null;
    method: string;
  };
  tos: {
    found: boolean;
    url: string | null;
    method: string;
  };
}

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, tos, timestamp } = analysis;

  if (login.hasPasswordInput || login.isLoginUrl) {
    await updateService(domain, { hasLoginPage: true });
    await addEvent({
      type: "login_detected",
      domain,
      timestamp,
      details: login,
    });
  }

  if (privacy.found && privacy.url) {
    await updateService(domain, { privacyPolicyUrl: privacy.url });
    await addEvent({
      type: "privacy_policy_found",
      domain,
      timestamp,
      details: { url: privacy.url, method: privacy.method },
    });
  }

  if (tos.found && tos.url) {
    await updateService(domain, { termsOfServiceUrl: tos.url });
    await addEvent({
      type: "terms_of_service_found",
      domain,
      timestamp,
      details: { url: tos.url, method: tos.method },
    });
  }
}

let cspReporter: CSPReporter | null = null;
let reportQueue: CSPReport[] = [];

async function handleCSPViolation(
  data: Omit<CSPViolation, "type"> & { type?: string },
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; reason?: string }> {
  const storage = await initStorage();
  const config = storage.cspConfig || DEFAULT_CSP_CONFIG;

  if (!config.enabled || !config.collectCSPViolations) {
    return { success: false, reason: "Disabled" };
  }

  const violation: CSPViolation = {
    type: "csp-violation",
    timestamp: data.timestamp || new Date().toISOString(),
    pageUrl: sender.tab?.url || data.pageUrl,
    directive: data.directive,
    blockedURL: data.blockedURL,
    domain: data.domain,
    disposition: data.disposition,
    originalPolicy: data.originalPolicy,
    sourceFile: data.sourceFile,
    lineNumber: data.lineNumber,
    columnNumber: data.columnNumber,
    statusCode: data.statusCode,
  };

  await storeCSPReport(violation);
  reportQueue.push(violation);

  await addEvent({
    type: "csp_violation",
    domain: violation.domain,
    timestamp: Date.now(),
    details: {
      directive: violation.directive,
      blockedURL: violation.blockedURL,
      disposition: violation.disposition,
    },
  });

  return { success: true };
}

async function handleNetworkRequest(
  data: Omit<NetworkRequest, "type"> & { type?: string },
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; reason?: string }> {
  const storage = await initStorage();
  const config = storage.cspConfig || DEFAULT_CSP_CONFIG;

  if (!config.enabled || !config.collectNetworkRequests) {
    return { success: false, reason: "Disabled" };
  }

  const request: NetworkRequest = {
    type: "network-request",
    timestamp: data.timestamp || new Date().toISOString(),
    pageUrl: sender.tab?.url || data.pageUrl,
    url: data.url,
    method: data.method,
    initiator: data.initiator,
    domain: data.domain,
    resourceType: data.resourceType,
  };

  await storeCSPReport(request);
  reportQueue.push(request);

  return { success: true };
}

async function storeCSPReport(report: CSPReport) {
  try {
    if (!apiClient) {
      apiClient = await getApiClient();
    }
    await apiClient.postReports([report]);
  } catch (error) {
    console.error("[Service Policy Auditor] Error storing report:", error);
  }
}

async function flushReportQueue() {
  if (!cspReporter || reportQueue.length === 0) return;

  const batch = reportQueue.splice(0, 100);
  const success = await cspReporter.send(batch);

  if (!success) {
    reportQueue.unshift(...batch);
  }
}

async function generateCSPPolicy(
  options?: Partial<CSPGenerationOptions>
): Promise<GeneratedCSPPolicy> {
  const cspReports = await getCSPReports();
  const analyzer = new CSPAnalyzer(cspReports);
  return analyzer.generatePolicy({
    strictMode: options?.strictMode ?? false,
    includeReportUri: options?.includeReportUri ?? false,
    reportUri: options?.reportUri ?? "",
    defaultSrc: options?.defaultSrc ?? "'self'",
    includeNonce: options?.includeNonce ?? false,
  });
}

async function generateCSPPolicyByDomain(
  options?: Partial<CSPGenerationOptions>
): Promise<GeneratedCSPByDomain> {
  const cspReports = await getCSPReports();
  const analyzer = new CSPAnalyzer(cspReports);
  return analyzer.generatePolicyByDomain({
    strictMode: options?.strictMode ?? false,
    includeReportUri: options?.includeReportUri ?? false,
    reportUri: options?.reportUri ?? "",
    defaultSrc: options?.defaultSrc ?? "'self'",
    includeNonce: options?.includeNonce ?? false,
  });
}

async function getCSPConfig(): Promise<CSPConfig> {
  const storage = await initStorage();
  return storage.cspConfig || DEFAULT_CSP_CONFIG;
}

async function setCSPConfig(
  newConfig: Partial<CSPConfig>
): Promise<{ success: boolean }> {
  const current = await getCSPConfig();
  const updated = { ...current, ...newConfig };
  await saveStorage({ cspConfig: updated });

  if (cspReporter) {
    const endpoint =
      updated.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
    cspReporter.setEndpoint(endpoint);
  }

  return { success: true };
}

async function clearCSPData(): Promise<{ success: boolean }> {
  try {
    if (!apiClient) {
      apiClient = await getApiClient();
    }
    await apiClient.clearReports();
    reportQueue = [];
    return { success: true };
  } catch (error) {
    console.error("[Service Policy Auditor] Error clearing data:", error);
    return { success: false };
  }
}

async function getCSPReports(options?: {
  type?: "csp-violation" | "network-request";
}): Promise<CSPReport[]> {
  try {
    if (!apiClient) {
      apiClient = await getApiClient();
    }

    if (options?.type === "csp-violation") {
      const { violations } = await apiClient.getViolations();
      return violations;
    }
    if (options?.type === "network-request") {
      const { requests } = await apiClient.getNetworkRequests();
      return requests;
    }

    const { reports } = await apiClient.getReports();
    return reports;
  } catch (error) {
    console.error("[Service Policy Auditor] Error getting CSP reports:", error);
    return [];
  }
}

async function getConnectionConfig(): Promise<{ mode: ConnectionMode; endpoint: string | null }> {
  if (!apiClient) {
    apiClient = await getApiClient();
  }
  return {
    mode: apiClient.getMode(),
    endpoint: apiClient.getEndpoint(),
  };
}

// ===== AI Prompt Monitor Functions =====

const MAX_AI_PROMPTS = 500;

async function handleAIPromptCaptured(
  data: CapturedAIPrompt
): Promise<{ success: boolean }> {
  const storage = await getStorage();
  const config = storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;

  if (!config.enabled) {
    return { success: false };
  }

  // Store AI prompt
  await storeAIPrompt(data);

  // Extract domain from API endpoint
  let domain = "unknown";
  try {
    domain = new URL(data.apiEndpoint).hostname;
  } catch {
    // ignore
  }

  // Add prompt sent event
  await addEvent({
    type: "ai_prompt_sent",
    domain,
    timestamp: data.timestamp,
    details: {
      provider: data.provider || "unknown",
      model: data.model,
      promptPreview: getPromptPreview(data.prompt),
      contentSize: data.prompt.contentSize,
      messageCount: data.prompt.messages?.length,
    },
  });

  // Add response received event if available
  if (data.response) {
    await addEvent({
      type: "ai_response_received",
      domain,
      timestamp: data.responseTimestamp || Date.now(),
      details: {
        provider: data.provider || "unknown",
        model: data.model,
        responsePreview: data.response.text?.substring(0, 100) || "",
        contentSize: data.response.contentSize,
        latencyMs: data.response.latencyMs,
        isStreaming: data.response.isStreaming,
      },
    });
  }

  return { success: true };
}

function getPromptPreview(prompt: CapturedAIPrompt["prompt"]): string {
  if (prompt.messages?.length) {
    const lastUserMsg = [...prompt.messages]
      .reverse()
      .find((m) => m.role === "user");
    return lastUserMsg?.content.substring(0, 100) || "";
  }
  return (
    prompt.text?.substring(0, 100) || prompt.rawBody?.substring(0, 100) || ""
  );
}

async function storeAIPrompt(prompt: CapturedAIPrompt) {
  return queueStorageOperation(async () => {
    const storage = await getStorage();
    const config = storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;
    const maxPrompts = config.maxStoredRecords || MAX_AI_PROMPTS;

    const aiPrompts = storage.aiPrompts || [];
    aiPrompts.unshift(prompt);

    if (aiPrompts.length > maxPrompts) {
      aiPrompts.splice(maxPrompts);
    }

    await setStorage({ aiPrompts });
  });
}

async function getAIPrompts(): Promise<CapturedAIPrompt[]> {
  const storage = await getStorage();
  return storage.aiPrompts || [];
}

async function getAIMonitorConfig(): Promise<AIMonitorConfig> {
  const storage = await getStorage();
  return storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;
}

async function setAIMonitorConfig(
  newConfig: Partial<AIMonitorConfig>
): Promise<{ success: boolean }> {
  const current = await getAIMonitorConfig();
  const updated = { ...current, ...newConfig };
  await setStorage({ aiMonitorConfig: updated });
  return { success: true };
}

async function clearAIData(): Promise<{ success: boolean }> {
  await clearAIPrompts();
  return { success: true };
}

async function setConnectionConfig(
  mode: ConnectionMode,
  endpoint?: string
): Promise<{ success: boolean }> {
  try {
    await updateApiClientConfig(mode, endpoint);
    return { success: true };
  } catch (error) {
    console.error("[Service Policy Auditor] Error setting connection config:", error);
    return { success: false };
  }
}

async function getSyncConfig(): Promise<{ enabled: boolean; endpoint: string | null }> {
  if (!syncManager) {
    syncManager = await getSyncManager();
  }
  return {
    enabled: syncManager.isEnabled(),
    endpoint: syncManager.getRemoteEndpoint(),
  };
}

async function setSyncConfig(
  enabled: boolean,
  endpoint?: string
): Promise<{ success: boolean }> {
  try {
    if (!syncManager) {
      syncManager = await getSyncManager();
    }
    await syncManager.setEnabled(enabled, endpoint);
    return { success: true };
  } catch (error) {
    console.error("[Service Policy Auditor] Error setting sync config:", error);
    return { success: false };
  }
}

async function triggerSync(): Promise<{ success: boolean; sent: number; received: number }> {
  try {
    if (!syncManager) {
      syncManager = await getSyncManager();
    }
    const result = await syncManager.sync();
    return { success: true, ...result };
  } catch (error) {
    console.error("[Service Policy Auditor] Error triggering sync:", error);
    return { success: false, sent: 0, received: 0 };
  }
}

async function registerMainWorldScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ["api-hooks"] }).catch(() => {});
    await chrome.scripting.registerContentScripts([{
      id: "api-hooks",
      js: ["api-hooks.js"],
      matches: ["<all_urls>"],
      runAt: "document_start",
      world: "MAIN",
      persistAcrossSessions: true,
    }]);
  } catch (error) {
    console.error("[Service Policy Auditor] Failed to register main world script:", error);
  }
}

export default defineBackground(() => {
  registerMainWorldScript();
  getApiClient()
    .then(async (client) => {
      apiClient = client;
      const needsMigration = await checkMigrationNeeded();
      if (needsMigration) {
        await migrateToDatabase();
      }
    })
    .catch(console.error);

  getSyncManager()
    .then(async (manager) => {
      syncManager = manager;
      if (manager.isEnabled()) {
        await manager.startSync();
      }
    })
    .catch(console.error);

  getCSPConfig().then((config) => {
    const endpoint =
      config.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
    cspReporter = new CSPReporter(endpoint);
  });

  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "flushCSPReports") {
      flushReportQueue().catch(console.error);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Messages handled by offscreen document
    if (message.type === "LOCAL_API_REQUEST" || message.type === "OFFSCREEN_READY") {
      return false;
    }

    if (message.type === "PAGE_ANALYZED") {
      handlePageAnalysis(message.payload).catch(console.error);
      return true;
    }

    if (message.type === "CSP_VIOLATION") {
      handleCSPViolation(message.data, sender)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "NETWORK_REQUEST") {
      handleNetworkRequest(message.data, sender)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "GET_CSP_REPORTS") {
      getCSPReports(message.data)
        .then(sendResponse)
        .catch(() => sendResponse([]));
      return true;
    }

    if (message.type === "GENERATE_CSP") {
      generateCSPPolicy(message.data?.options)
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "GENERATE_CSP_BY_DOMAIN") {
      generateCSPPolicyByDomain(message.data?.options)
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "GET_CSP_CONFIG") {
      getCSPConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_CSP_CONFIG));
      return true;
    }

    if (message.type === "SET_CSP_CONFIG") {
      setCSPConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "CLEAR_CSP_DATA") {
      clearCSPData()
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "GET_STATS") {
      (async () => {
        try {
          if (!apiClient) {
            apiClient = await getApiClient();
          }
          const stats = await apiClient.getStats();
          sendResponse(stats);
        } catch (error) {
          sendResponse({ violations: 0, requests: 0, uniqueDomains: 0 });
        }
      })();
      return true;
    }

    if (message.type === "GET_CONNECTION_CONFIG") {
      getConnectionConfig()
        .then(sendResponse)
        .catch(() => sendResponse({ mode: "local", endpoint: null }));
      return true;
    }

    if (message.type === "SET_CONNECTION_CONFIG") {
      setConnectionConfig(message.data.mode, message.data.endpoint)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "GET_SYNC_CONFIG") {
      getSyncConfig()
        .then(sendResponse)
        .catch(() => sendResponse({ enabled: false, endpoint: null }));
      return true;
    }

    if (message.type === "SET_SYNC_CONFIG") {
      setSyncConfig(message.data.enabled, message.data.endpoint)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "TRIGGER_SYNC") {
      triggerSync()
        .then(sendResponse)
        .catch(() => sendResponse({ success: false, sent: 0, received: 0 }));
      return true;
    }

    // AI Prompt handlers
    if (message.type === "AI_PROMPT_CAPTURED") {
      handleAIPromptCaptured(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "GET_AI_PROMPTS") {
      getAIPrompts()
        .then(sendResponse)
        .catch(() => sendResponse([]));
      return true;
    }

    if (message.type === "GET_AI_MONITOR_CONFIG") {
      getAIMonitorConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_AI_MONITOR_CONFIG));
      return true;
    }

    if (message.type === "SET_AI_MONITOR_CONFIG") {
      setAIMonitorConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "CLEAR_AI_DATA") {
      clearAIData()
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    // NRD Detection handlers
    if (message.type === "CHECK_NRD") {
      handleNRDCheck(message.data.domain)
        .then(sendResponse)
        .catch(() => sendResponse({ error: true }));
      return true;
    }

    if (message.type === "GET_NRD_CONFIG") {
      getNRDConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_NRD_CONFIG));
      return true;
    }

    if (message.type === "SET_NRD_CONFIG") {
      setNRDConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    return true;
  });

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");
    addCookieToService(domain, cookie).catch(console.error);
    addEvent({
      type: "cookie_set",
      domain,
      timestamp: cookie.detectedAt,
      details: {
        name: cookie.name,
        isSession: cookie.isSession,
      },
    }).catch(console.error);
  });

  updateBadge();
});
