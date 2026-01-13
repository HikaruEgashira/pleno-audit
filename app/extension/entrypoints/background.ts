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
  NRDCache,
  TyposquatConfig,
  TyposquatResult,
  TyposquatDetectedDetails,
  TyposquatCache,
  DetectionResult,
} from "@pleno-audit/detectors";
import {
  DEFAULT_AI_MONITOR_CONFIG,
  DEFAULT_NRD_CONFIG,
  DEFAULT_TYPOSQUAT_CONFIG,
  createNRDDetector,
  createTyposquatDetector,
} from "@pleno-audit/detectors";
import type {
  CSPViolation,
  NetworkRequest,
  CSPReport,
  CSPConfig,
  CSPViolationDetails,
  NetworkRequestDetails,
  GeneratedCSPPolicy,
  CSPGenerationOptions,
} from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG, CSPAnalyzer, CSPReporter, type GeneratedCSPByDomain } from "@pleno-audit/csp";
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
  createExtensionMonitor,
  createLogger,
  DEFAULT_EXTENSION_MONITOR_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  type ApiClient,
  type ConnectionMode,
  type SyncManager,
  type QueryOptions,
  type ExtensionMonitor,
  type ExtensionMonitorConfig,
  type ExtensionRequestRecord,
  type DataRetentionConfig,
  type DetectionConfig,
} from "@pleno-audit/extension-runtime";

const logger = createLogger("background");
import type { ExtensionRequestDetails } from "@pleno-audit/detectors";
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
} from "@pleno-audit/storage";
import { ParquetStore, domainRiskProfileToParquetRecord } from "@pleno-audit/parquet-storage";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

interface StorageData {
  services: Record<string, DetectedService>;
  cspReports: CSPReport[];
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
}

let storageQueue: Promise<void> = Promise.resolve();
let apiClient: ApiClient | null = null;
let syncManager: SyncManager | null = null;
let parquetStore: ParquetStore | null = null;

// NRD Detection
const nrdCache: Map<string, NRDResult> = new Map();
let nrdDetector: ReturnType<typeof createNRDDetector> | null = null;

const nrdCacheAdapter: NRDCache = {
  get: (domain) => nrdCache.get(domain) ?? null,
  set: (domain, result) => nrdCache.set(domain, result),
  clear: () => nrdCache.clear(),
};

// Typosquatting Detection
const typosquatCache: Map<string, TyposquatResult> = new Map();
let typosquatDetector: ReturnType<typeof createTyposquatDetector> | null = null;

const typosquatCacheAdapter: TyposquatCache = {
  get: (domain) => typosquatCache.get(domain) ?? null,
  set: (domain, result) => typosquatCache.set(domain, result),
  clear: () => typosquatCache.clear(),
};

// Extension Monitor
let extensionMonitor: ExtensionMonitor | null = null;
const extensionRequestBuffer: ExtensionRequestRecord[] = [];
const EXTENSION_BUFFER_FLUSH_INTERVAL = 5000;

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
    "cspReports",
    "cspConfig",
    "detectionConfig",
  ]);
  return {
    services: result.services || {},
    cspReports: result.cspReports || [],
    cspConfig: result.cspConfig || DEFAULT_CSP_CONFIG,
    detectionConfig: result.detectionConfig || DEFAULT_DETECTION_CONFIG,
  };
}

async function saveStorage(data: Partial<StorageData>) {
  await chrome.storage.local.set(data);
}

async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(["services"]);
    const services = result.services || {};
    const store = await getOrInitParquetStore();

    // Count only problematic detections (NRD or typosquat)
    const count = Object.values(services).filter(
      (service: DetectedService) =>
        service.nrdResult?.isNRD || service.typosquatResult?.isTyposquat
    ).length;

    // Log domain risk profiles to Parquet for all services
    const riskProfiles = Object.values(services)
      .filter((service: any) => service && service.domain)
      .map((service: any) => domainRiskProfileToParquetRecord(service));

    if (riskProfiles.length > 0) {
      await store.write("domain-risk-profiles", riskProfiles);
    }

    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: count > 0 ? "#dc2626" : "#666" });
  } catch (error) {
    logger.warn("Failed to update badge:", error);
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
    }
  | {
      type: "typosquat_detected";
      domain: string;
      timestamp: number;
      details: TyposquatDetectedDetails;
    }
  | {
      type: "extension_request";
      domain: string;
      timestamp: number;
      details: ExtensionRequestDetails;
    };

async function getOrInitParquetStore(): Promise<ParquetStore> {
  if (!parquetStore) {
    parquetStore = new ParquetStore();
    await parquetStore.init();
  }
  return parquetStore;
}

async function addEvent(event: NewEvent): Promise<EventLog> {
  const store = await getOrInitParquetStore();
  const eventId = generateEventId();
  const newEvent = {
    ...event,
    id: eventId,
  } as EventLog;

  // ParquetEvent形式に変換
  const parquetEvent = {
    id: eventId,
    type: event.type,
    domain: event.domain,
    timestamp: Date.now(), // ミリ秒
    details: JSON.stringify(event.details || {}),
  };

  // Parquetストアに記録
  await store.addEvents([parquetEvent]);
  await updateBadge();
  return newEvent;
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

async function handleNRDCheck(domain: string): Promise<NRDResult | { skipped: true; reason: string }> {
  try {
    const storage = await initStorage();
    const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

    if (!detectionConfig.enableNRD) {
      return { skipped: true, reason: "NRD detection disabled" };
    }

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
          suspiciousScore: result.suspiciousScores.totalScore,
          isDDNS: result.ddns.isDDNS,
          ddnsProvider: result.ddns.provider,
        },
      });
    }

    return result;
  } catch (error) {
    logger.error("NRD check failed:", error);
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
    logger.error("Error setting NRD config:", error);
    return { success: false };
  }
}

// ============================================================================
// Typosquatting Detection
// ============================================================================

async function getTyposquatConfig(): Promise<TyposquatConfig> {
  const storage = await getStorage();
  return storage.typosquatConfig || DEFAULT_TYPOSQUAT_CONFIG;
}

async function initTyposquatDetector() {
  const config = await getTyposquatConfig();
  typosquatDetector = createTyposquatDetector(config, typosquatCacheAdapter);
}

function checkTyposquat(domain: string): TyposquatResult {
  if (!typosquatDetector) {
    // Sync init since detector creation is synchronous
    const config = DEFAULT_TYPOSQUAT_CONFIG;
    typosquatDetector = createTyposquatDetector(config, typosquatCacheAdapter);
  }
  return typosquatDetector.checkDomain(domain);
}

async function handleTyposquatCheck(domain: string): Promise<TyposquatResult | { skipped: true; reason: string }> {
  try {
    const storage = await initStorage();
    const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

    if (!detectionConfig.enableTyposquat) {
      return { skipped: true, reason: "Typosquat detection disabled" };
    }

    // Ensure detector is initialized with latest config
    if (!typosquatDetector) {
      await initTyposquatDetector();
    }

    const result = checkTyposquat(domain);

    // Update service with typosquat result if it's a positive detection
    if (result.isTyposquat) {
      await updateService(result.domain, {
        typosquatResult: {
          isTyposquat: result.isTyposquat,
          confidence: result.confidence,
          totalScore: result.heuristics.totalScore,
          checkedAt: result.checkedAt,
        },
      });

      // Add event log
      await addEvent({
        type: "typosquat_detected",
        domain: result.domain,
        timestamp: Date.now(),
        details: {
          isTyposquat: result.isTyposquat,
          confidence: result.confidence,
          totalScore: result.heuristics.totalScore,
          homoglyphCount: result.heuristics.homoglyphs.length,
          hasMixedScript: result.heuristics.hasMixedScript,
          detectedScripts: result.heuristics.detectedScripts,
        },
      });
    }

    return result;
  } catch (error) {
    logger.error("Typosquat check failed:", error);
    throw error;
  }
}

async function setTyposquatConfig(newConfig: TyposquatConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ typosquatConfig: newConfig });
    // Reinitialize detector with new config
    await initTyposquatDetector();
    // Clear cache on config change
    typosquatCacheAdapter.clear();
    return { success: true };
  } catch (error) {
    logger.error("Error setting Typosquat config:", error);
    return { success: false };
  }
}

// ============================================================================
// Extension Network Monitor
// ============================================================================

async function getExtensionMonitorConfig(): Promise<ExtensionMonitorConfig> {
  const storage = await getStorage();
  return storage.extensionMonitorConfig || DEFAULT_EXTENSION_MONITOR_CONFIG;
}

async function setExtensionMonitorConfig(newConfig: ExtensionMonitorConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ extensionMonitorConfig: newConfig });
    // Restart monitor with new config
    if (extensionMonitor) {
      extensionMonitor.stop();
      extensionMonitor = null;
    }
    if (newConfig.enabled) {
      await initExtensionMonitor();
    }
    return { success: true };
  } catch (error) {
    logger.error("Error setting extension monitor config:", error);
    return { success: false };
  }
}

async function initExtensionMonitor() {
  const config = await getExtensionMonitorConfig();
  if (!config.enabled) return;

  const ownId = chrome.runtime.id;
  extensionMonitor = createExtensionMonitor(config, ownId);

  extensionMonitor.onRequest(async (record) => {
    extensionRequestBuffer.push(record);

    // Add to event log
    await addEvent({
      type: "extension_request",
      domain: record.domain,
      timestamp: record.timestamp,
      details: {
        extensionId: record.extensionId,
        extensionName: record.extensionName,
        url: record.url,
        method: record.method,
        resourceType: record.resourceType,
        statusCode: record.statusCode,
      },
    });
  });

  await extensionMonitor.start();
  logger.info("Extension monitor started");
}

async function flushExtensionRequestBuffer() {
  if (extensionRequestBuffer.length === 0) return;

  const toFlush = extensionRequestBuffer.splice(0, extensionRequestBuffer.length);
  const storage = await getStorage();
  const config = storage.extensionMonitorConfig || DEFAULT_EXTENSION_MONITOR_CONFIG;

  let requests = storage.extensionRequests || [];
  requests = [...toFlush, ...requests].slice(0, config.maxStoredRequests);

  await setStorage({ extensionRequests: requests });
}

async function getExtensionRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: ExtensionRequestRecord[]; total: number }> {
  const storage = await getStorage();
  const requests = storage.extensionRequests || [];
  const total = requests.length;

  const offset = options?.offset || 0;
  const limit = options?.limit || 500;
  const sliced = requests.slice(offset, offset + limit);

  return { requests: sliced, total };
}

function getKnownExtensions(): Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }> {
  if (!extensionMonitor) return {};
  const map = extensionMonitor.getKnownExtensions();
  return Object.fromEntries(map);
}

interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[] }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

async function getExtensionStats(): Promise<ExtensionStats> {
  const storage = await getStorage();
  const requests = storage.extensionRequests || [];

  const byExtension: Record<string, { name: string; count: number; domains: Set<string> }> = {};
  const byDomain: Record<string, { count: number; extensions: Set<string> }> = {};

  for (const req of requests) {
    // By extension
    if (!byExtension[req.extensionId]) {
      byExtension[req.extensionId] = { name: req.extensionName, count: 0, domains: new Set() };
    }
    byExtension[req.extensionId].count++;
    byExtension[req.extensionId].domains.add(req.domain);

    // By domain
    if (!byDomain[req.domain]) {
      byDomain[req.domain] = { count: 0, extensions: new Set() };
    }
    byDomain[req.domain].count++;
    byDomain[req.domain].extensions.add(req.extensionId);
  }

  // Convert Sets to arrays for serialization
  const byExtensionResult: ExtensionStats["byExtension"] = {};
  for (const [id, data] of Object.entries(byExtension)) {
    byExtensionResult[id] = { name: data.name, count: data.count, domains: Array.from(data.domains) };
  }

  const byDomainResult: ExtensionStats["byDomain"] = {};
  for (const [domain, data] of Object.entries(byDomain)) {
    byDomainResult[domain] = { count: data.count, extensions: Array.from(data.extensions) };
  }

  return { byExtension: byExtensionResult, byDomain: byDomainResult, total: requests.length };
}

// ============================================================================
// Data Retention
// ============================================================================

async function getDataRetentionConfig(): Promise<DataRetentionConfig> {
  const storage = await getStorage();
  return storage.dataRetentionConfig || DEFAULT_DATA_RETENTION_CONFIG;
}

async function setDataRetentionConfig(newConfig: DataRetentionConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ dataRetentionConfig: newConfig });
    return { success: true };
  } catch (error) {
    logger.error("Error setting data retention config:", error);
    return { success: false };
  }
}

async function cleanupOldData(): Promise<{ deleted: number }> {
  try {
    const config = await getDataRetentionConfig();
    // retentionDays === 0 means no expiration
    if (!config.autoCleanupEnabled || config.retentionDays === 0) {
      return { deleted: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    if (!apiClient) {
      apiClient = await getApiClient();
    }

    // Delete old CSP reports from database
    const deleted = await apiClient.deleteOldReports(cutoffTimestamp);

    // Delete old events from Parquet storage
    const store = await getOrInitParquetStore();
    const cutoffDate_ = cutoffDate.toISOString().split("T")[0];
    await store.deleteOldReports(cutoffDate_);

    // Delete old AI prompts from storage
    const storage = await getStorage();
    const aiPrompts = storage.aiPrompts || [];
    const filteredPrompts = aiPrompts.filter(p => p.timestamp >= cutoffMs);
    if (filteredPrompts.length < aiPrompts.length) {
      await setStorage({ aiPrompts: filteredPrompts });
    }

    // Delete old extension requests
    const extensionRequests = storage.extensionRequests || [];
    const filteredRequests = extensionRequests.filter(r => r.timestamp >= cutoffMs);
    if (filteredRequests.length < extensionRequests.length) {
      await setStorage({ extensionRequests: filteredRequests });
    }

    // Update last cleanup timestamp
    await setStorage({
      dataRetentionConfig: {
        ...config,
        lastCleanupTimestamp: Date.now(),
      },
    });

    logger.info(`Data cleanup completed. Deleted ${deleted} CSP reports.`);
    return { deleted };
  } catch (error) {
    logger.error("Error during data cleanup:", error);
    return { deleted: 0 };
  }
}

// ============================================================================
// Detection Config
// ============================================================================

async function getDetectionConfig(): Promise<DetectionConfig> {
  const storage = await initStorage();
  return storage.detectionConfig || DEFAULT_DETECTION_CONFIG;
}

async function setDetectionConfig(
  newConfig: Partial<DetectionConfig>
): Promise<{ success: boolean }> {
  const current = await getDetectionConfig();
  const updated = { ...current, ...newConfig };
  await saveStorage({ detectionConfig: updated });
  return { success: true };
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
  privacy: DetectionResult;
  tos: DetectionResult;
  faviconUrl?: string | null;
}

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, tos, timestamp, faviconUrl } = analysis;
  const storage = await initStorage();
  const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

  // faviconUrlを保存
  if (faviconUrl) {
    await updateService(domain, { faviconUrl });
  }

  if (detectionConfig.enableLogin && (login.hasPasswordInput || login.isLoginUrl)) {
    await updateService(domain, { hasLoginPage: true });
    await addEvent({
      type: "login_detected",
      domain,
      timestamp,
      details: login,
    });
  }

  if (detectionConfig.enablePrivacy && privacy.found && privacy.url) {
    await updateService(domain, { privacyPolicyUrl: privacy.url });
    await addEvent({
      type: "privacy_policy_found",
      domain,
      timestamp,
      details: { url: privacy.url, method: privacy.method },
    });
  }

  if (detectionConfig.enableTos && tos.found && tos.url) {
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
    logger.error("Error storing report:", error);
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

function extractReportsArray(result: CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean }): CSPReport[] {
  return Array.isArray(result) ? result : result.reports;
}

async function generateCSPPolicy(
  options?: Partial<CSPGenerationOptions>
): Promise<GeneratedCSPPolicy> {
  const result = await getCSPReports();
  const cspReports = extractReportsArray(result);
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
  const result = await getCSPReports();
  const cspReports = extractReportsArray(result);
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
    logger.error("Error clearing data:", error);
    return { success: false };
  }
}

async function getCSPReports(options?: {
  type?: "csp-violation" | "network-request";
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
}): Promise<CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean }> {
  try {
    if (!apiClient) {
      apiClient = await getApiClient();
    }

    const queryOptions: QueryOptions = {
      limit: options?.limit,
      offset: options?.offset,
      since: options?.since,
      until: options?.until,
    };

    const hasPaginationParams = options?.limit !== undefined || options?.offset !== undefined || options?.since || options?.until;

    if (options?.type === "csp-violation") {
      const result = await apiClient.getViolations(queryOptions);
      if (hasPaginationParams) {
        return { reports: result.violations, total: result.total ?? 0, hasMore: result.hasMore ?? false };
      }
      return result.violations;
    }
    if (options?.type === "network-request") {
      const result = await apiClient.getNetworkRequests(queryOptions);
      if (hasPaginationParams) {
        return { reports: result.requests, total: result.total ?? 0, hasMore: result.hasMore ?? false };
      }
      return result.requests;
    }

    const result = await apiClient.getReports(queryOptions);
    if (hasPaginationParams) {
      return { reports: result.reports, total: result.total ?? 0, hasMore: result.hasMore ?? false };
    }
    return result.reports;
  } catch (error) {
    logger.error("Error getting CSP reports:", error);
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
  const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;
  const config = storage.aiMonitorConfig || DEFAULT_AI_MONITOR_CONFIG;

  if (!detectionConfig.enableAI || !config.enabled) {
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

  // Update service with AI detection info (use pageUrl domain, not API endpoint)
  let pageDomain = "unknown";
  try {
    pageDomain = new URL(data.pageUrl).hostname;
  } catch {
    // ignore
  }

  if (pageDomain !== "unknown") {
    const storage = await getStorage();
    const existingService = storage.services?.[pageDomain];
    const existingProviders = existingService?.aiDetected?.providers || [];
    const provider = data.provider || "unknown";
    const providers = existingProviders.includes(provider)
      ? existingProviders
      : [...existingProviders, provider];

    await updateService(pageDomain, {
      aiDetected: {
        hasAIActivity: true,
        lastActivityAt: data.timestamp,
        providers,
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

async function getAIPromptsCount(): Promise<number> {
  const storage = await getStorage();
  return (storage.aiPrompts || []).length;
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
    logger.error("Error setting connection config:", error);
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
    logger.error("Error setting sync config:", error);
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
    logger.error("Error triggering sync:", error);
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
    logger.error("Failed to register main world script:", error);
  }
}

export default defineBackground(() => {
  registerMainWorldScript();

  // Initialize debug bridge in dev mode
  if (import.meta.env.DEV) {
    import("../lib/debug-bridge.js").then(({ initDebugBridge }) => {
      initDebugBridge();
    }).catch((err) => logger.debug("Debug bridge init failed:", err));
  }

  // EventStoreを即座に初期化（ServiceWorkerスリープ対策）
  getOrInitParquetStore()
    .then(() => logger.info("EventStore initialized"))
    .catch((error) => logger.error("EventStore init failed:", error));

  getApiClient()
    .then(async (client) => {
      apiClient = client;
      const needsMigration = await checkMigrationNeeded();
      if (needsMigration) {
        await migrateToDatabase();
      }
    })
    .catch((err) => logger.debug("API client init failed:", err));

  getSyncManager()
    .then(async (manager) => {
      syncManager = manager;
      if (manager.isEnabled()) {
        await manager.startSync();
      }
    })
    .catch((err) => logger.debug("Sync manager init failed:", err));

  getCSPConfig().then((config) => {
    const endpoint =
      config.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
    cspReporter = new CSPReporter(endpoint);
  });

  // Migrate events from chrome.storage.local to IndexedDB if needed
  (async () => {
    try {
      const needsMigration = await checkEventsMigrationNeeded();
      if (needsMigration) {
        const store = await getOrInitParquetStore();
        const result = await migrateEventsToIndexedDB(store);
        logger.info(`Event migration: ${result.success ? "success" : "failed"}`, result);
      }
    } catch (error) {
      logger.error("Event migration error:", error);
    }
  })();

  // Extension Monitor初期化
  initExtensionMonitor().catch((err) => logger.debug("Extension monitor init failed:", err));

  // ServiceWorker keep-alive用のalarm（30秒ごとにwake-up）
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
  chrome.alarms.create("flushExtensionRequests", { periodInMinutes: 0.1 });
  // Data cleanup alarm (runs once per day)
  chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
      // ServiceWorkerをアクティブに保つ（何もしない）
      return;
    }
    if (alarm.name === "flushCSPReports") {
      flushReportQueue().catch((err) => logger.debug("Flush reports failed:", err));
    }
    if (alarm.name === "flushExtensionRequests") {
      flushExtensionRequestBuffer().catch((err) => logger.debug("Flush extension requests failed:", err));
    }
    if (alarm.name === "dataCleanup") {
      cleanupOldData().catch((err) => logger.debug("Data cleanup failed:", err));
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Messages handled by offscreen document
    if (message.type === "LOCAL_API_REQUEST" || message.type === "OFFSCREEN_READY") {
      return false;
    }

    if (message.type === "PAGE_ANALYZED") {
      handlePageAnalysis(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
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

    if (message.type === "GET_AI_PROMPTS_COUNT") {
      getAIPromptsCount()
        .then((count) => sendResponse({ count }))
        .catch(() => sendResponse({ count: 0 }));
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

    // Typosquatting Detection handlers
    if (message.type === "CHECK_TYPOSQUAT") {
      handleTyposquatCheck(message.data.domain)
        .then(sendResponse)
        .catch(() => sendResponse({ error: true }));
      return true;
    }

    if (message.type === "GET_TYPOSQUAT_CONFIG") {
      getTyposquatConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_TYPOSQUAT_CONFIG));
      return true;
    }

    if (message.type === "SET_TYPOSQUAT_CONFIG") {
      setTyposquatConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    // Event handlers
    if (message.type === "GET_EVENTS") {
      (async () => {
        try {
          const store = await getOrInitParquetStore();
          // タイムスタンプ形式を ISO形式に変換（ParquetStore対応）
          const options = message.data || {};
          if (typeof options.since === "number") {
            options.since = new Date(options.since).toISOString();
          }
          if (typeof options.until === "number") {
            options.until = new Date(options.until).toISOString();
          }
          const result = await store.getEvents(options);
          // ParquetEvent を EventLog形式に変換
          const events = result.data.map((e: any) => ({
            ...e,
            details: typeof e.details === "string" ? JSON.parse(e.details) : e.details,
            timestamp: new Date(e.timestamp).toISOString(),
          }));
          sendResponse({ events, total: result.total, hasMore: result.hasMore });
        } catch (error) {
          sendResponse({ events: [], total: 0, hasMore: false });
        }
      })();
      return true;
    }

    if (message.type === "GET_EVENTS_COUNT") {
      (async () => {
        try {
          const store = await getOrInitParquetStore();
          // タイムスタンプ形式を ISO形式に変換
          const options = message.data || {};
          if (typeof options.since === "number") {
            options.since = new Date(options.since).toISOString();
          }
          if (typeof options.until === "number") {
            options.until = new Date(options.until).toISOString();
          }
          const result = await store.getEvents(options);
          sendResponse({ count: result.total });
        } catch (error) {
          sendResponse({ count: 0 });
        }
      })();
      return true;
    }

    if (message.type === "CLEAR_EVENTS") {
      (async () => {
        try {
          const store = await getOrInitParquetStore();
          await store.clearAll();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false });
        }
      })();
      return true;
    }

    // Extension Monitor handlers
    if (message.type === "GET_EXTENSION_REQUESTS") {
      getExtensionRequests(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ requests: [], total: 0 }));
      return true;
    }

    if (message.type === "GET_KNOWN_EXTENSIONS") {
      sendResponse(getKnownExtensions());
      return false;
    }

    if (message.type === "GET_EXTENSION_STATS") {
      getExtensionStats()
        .then(sendResponse)
        .catch(() => sendResponse({ byExtension: {}, byDomain: {}, total: 0 }));
      return true;
    }

    if (message.type === "GET_EXTENSION_MONITOR_CONFIG") {
      getExtensionMonitorConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_EXTENSION_MONITOR_CONFIG));
      return true;
    }

    if (message.type === "SET_EXTENSION_MONITOR_CONFIG") {
      setExtensionMonitorConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    // Data Retention handlers
    if (message.type === "GET_DATA_RETENTION_CONFIG") {
      getDataRetentionConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_DATA_RETENTION_CONFIG));
      return true;
    }

    if (message.type === "SET_DATA_RETENTION_CONFIG") {
      setDataRetentionConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === "TRIGGER_DATA_CLEANUP") {
      cleanupOldData()
        .then(sendResponse)
        .catch(() => sendResponse({ deleted: 0 }));
      return true;
    }

    // Detection Config handlers
    if (message.type === "GET_DETECTION_CONFIG") {
      getDetectionConfig()
        .then(sendResponse)
        .catch(() => sendResponse(DEFAULT_DETECTION_CONFIG));
      return true;
    }

    if (message.type === "SET_DETECTION_CONFIG") {
      setDetectionConfig(message.data)
        .then(sendResponse)
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    // 未知のメッセージタイプはレスポンスを返さず同期的に処理
    logger.warn("Unknown message type:", message.type);
    return false;
  });

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");
    addCookieToService(domain, cookie).catch((err) => logger.debug("Add cookie to service failed:", err));
    addEvent({
      type: "cookie_set",
      domain,
      timestamp: cookie.detectedAt,
      details: {
        name: cookie.name,
        isSession: cookie.isSession,
      },
    }).catch((err) => logger.debug("Add cookie event failed:", err));
  });

  updateBadge();
});
