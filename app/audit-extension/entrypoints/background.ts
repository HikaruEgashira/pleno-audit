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
} from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import {
  startCookieMonitor,
  onCookieChange,
  getApiClient,
  updateApiClientConfig,
  ensureOffscreenDocument,
  checkMigrationNeeded,
  migrateToDatabase,
  getSyncManager,
  getSSOManager,
  getStorage,
  setStorage,
  clearAIPrompts,
  clearAllStorage,
  registerExtensionMonitorListener,
  createLogger,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createDoHMonitor,
  registerDoHMonitorListener,
  DEFAULT_DOH_MONITOR_CONFIG,
  getEnterpriseManager,
  type ApiClient,
  type BlockingConfig,
  type ConnectionMode,
  type SyncManager,
  type NetworkMonitorConfig,
  type DataRetentionConfig,
  type DetectionConfig,
  type NotificationConfig,
  type DoHMonitor,
  type DoHMonitorConfig,
  type DoHRequestRecord,
} from "@pleno-audit/extension-runtime";

const logger = createLogger("background");
import type { ExtensionRequestDetails } from "@pleno-audit/detectors";
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
} from "@pleno-audit/storage";
import {
  ParquetStore,
  nrdResultToParquetRecord,
  typosquatResultToParquetRecord,
} from "@pleno-audit/parquet-storage";
import {
  createAlertManager,
  createPolicyManager,
  DEFAULT_POLICY_CONFIG,
  type AlertManager,
  type SecurityAlert,
  type PolicyManager,
  type PolicyConfig,
} from "@pleno-audit/alerts";
import { createAlarmHandlers as createAlarmHandlersModule } from "../lib/background/alarm-handlers";
import { createAIPromptMonitorService } from "../lib/background/ai-prompt-monitor-service";
import { createCSPReportingService } from "../lib/background/csp-reporting-service";
import {
  createRuntimeMessageHandlers as createRuntimeMessageHandlersModule,
  runAsyncMessageHandler as runAsyncMessageHandlerModule,
  type RuntimeMessage,
} from "../lib/background/runtime-handlers";
import { createDebugBridgeHandler } from "../lib/background/debug-bridge-handler";
import { createAIPromptMonitorHandler } from "../lib/background/ai-prompt-monitor";
import {
  createExtensionNetworkService,
  type ExtensionStats,
} from "../lib/background/extension-network-service";
import {
  createSecurityEventHandlers,
  type ClipboardHijackData,
  type CookieAccessData,
  type DOMScrapingData,
  type DataExfiltrationData,
  type CredentialTheftData,
  type SupplyChainRiskData,
  type SuspiciousDownloadData,
  type TrackingBeaconData,
  type XSSDetectedData,
} from "../lib/background/security-event-handlers";

const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

interface StorageData {
  services: Record<string, DetectedService>;
  cspReports: CSPReport[];
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
  policyConfig: PolicyConfig;
}

let storageQueue: Promise<void> = Promise.resolve();
let apiClient: ApiClient | null = null;
let syncManager: SyncManager | null = null;
let parquetStore: ParquetStore | null = null;
let alertManager: AlertManager | null = null;
let policyManager: PolicyManager | null = null;
let doHMonitor: DoHMonitor | null = null;

type PolicyViolation = ReturnType<PolicyManager["checkDomain"]>["violations"][number];

async function ensureApiClient(): Promise<ApiClient> {
  if (!apiClient) {
    apiClient = await getApiClient();
  }
  return apiClient;
}

async function ensureSyncManager(): Promise<SyncManager> {
  if (!syncManager) {
    syncManager = await getSyncManager();
  }
  return syncManager;
}

async function alertPolicyViolations(domain: string, violations: PolicyViolation[]): Promise<void> {
  if (violations.length === 0) {
    return;
  }
  const am = getAlertManager();
  for (const violation of violations) {
    await am.alertPolicyViolation({
      domain,
      ruleId: violation.ruleId,
      ruleName: violation.ruleName,
      ruleType: violation.ruleType,
      action: violation.action,
      matchedPattern: violation.matchedPattern,
      target: violation.target,
    });
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

function getAlertManager(): AlertManager {
  if (!alertManager) {
    alertManager = createAlertManager({
      enabled: true,
      showNotifications: true,
      playSound: false,
      rules: [],
      severityFilter: ["critical", "high"],
    });

    // Subscribe to new alerts and show Chrome notifications
    alertManager.subscribe((alert: SecurityAlert) => {
      showChromeNotification(alert);
    });
  }
  return alertManager;
}

// ============================================================================
// Policy Manager
// ============================================================================

async function getPolicyManager(): Promise<PolicyManager> {
  if (!policyManager) {
    const storage = await initStorage();
    const config = storage.policyConfig || DEFAULT_POLICY_CONFIG;
    policyManager = createPolicyManager(config);
  }
  return policyManager;
}

async function checkDomainPolicy(domain: string): Promise<void> {
  const pm = await getPolicyManager();
  const result = pm.checkDomain(domain);
  await alertPolicyViolations(domain, result.violations);
}

async function checkAIServicePolicy(params: {
  domain: string;
  provider?: string;
  dataTypes?: string[];
}): Promise<void> {
  const pm = await getPolicyManager();
  const result = pm.checkAIService(params);
  await alertPolicyViolations(params.domain, result.violations);
}

async function checkDataTransferPolicy(params: {
  destination: string;
  sizeKB: number;
}): Promise<void> {
  const pm = await getPolicyManager();
  const result = pm.checkDataTransfer(params);
  await alertPolicyViolations(params.destination, result.violations);
}

async function showChromeNotification(alert: SecurityAlert): Promise<void> {
  try {
    // 通知設定をチェック（デフォルト無効）
    const storage = await getStorage();
    const notificationConfig = storage.notificationConfig || DEFAULT_NOTIFICATION_CONFIG;

    if (!notificationConfig.enabled) {
      logger.debug("Notification disabled, skipping:", alert.title);
      return;
    }

    // severityFilterをチェック
    if (!notificationConfig.severityFilter.includes(alert.severity)) {
      logger.debug("Notification filtered by severity:", alert.severity);
      return;
    }

    const iconUrl = alert.severity === "critical" || alert.severity === "high"
      ? "icon-dev-128.png"
      : "icon-128.png";

    await chrome.notifications.create(alert.id, {
      type: "basic",
      iconUrl,
      title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      message: alert.description,
      priority: alert.severity === "critical" ? 2 : alert.severity === "high" ? 1 : 0,
      requireInteraction: alert.severity === "critical",
    });
  } catch (error) {
    logger.warn("Failed to show notification:", error);
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Open dashboard to alerts
  await chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html#graph"),
  });
  chrome.notifications.clear(notificationId);
});

// ============================================================================
// DoH Monitor Config
// ============================================================================

async function getDoHMonitorConfig(): Promise<DoHMonitorConfig> {
  const storage = await getStorage();
  return storage.doHMonitorConfig || DEFAULT_DOH_MONITOR_CONFIG;
}

async function setDoHMonitorConfig(config: Partial<DoHMonitorConfig>): Promise<{ success: boolean }> {
  const storage = await getStorage();
  storage.doHMonitorConfig = { ...DEFAULT_DOH_MONITOR_CONFIG, ...storage.doHMonitorConfig, ...config };
  await setStorage(storage);

  // Update running monitor
  if (doHMonitor) {
    await doHMonitor.updateConfig(storage.doHMonitorConfig);
  }

  return { success: true };
}

async function getDoHRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: DoHRequestRecord[]; total: number }> {
  const storage = await getStorage();
  const allRequests = storage.doHRequests || [];
  const total = allRequests.length;

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  // Sort by timestamp descending (newest first)
  const sorted = [...allRequests].sort((a, b) => b.timestamp - a.timestamp);
  const requests = sorted.slice(offset, offset + limit);

  return { requests, total };
}

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
    }
  | {
      type: "ai_sensitive_data_detected";
      domain: string;
      timestamp: number;
      details: AISensitiveDataDetectedDetails;
    }
  | {
      type: "data_exfiltration_detected";
      domain: string;
      timestamp: number;
      details: DataExfiltrationDetectedDetails;
    }
  | {
      type: "credential_theft_risk";
      domain: string;
      timestamp: number;
      details: CredentialTheftRiskDetails;
    }
  | {
      type: "supply_chain_risk";
      domain: string;
      timestamp: number;
      details: SupplyChainRiskDetails;
    };

/** AI機密情報検出イベント詳細 */
interface AISensitiveDataDetectedDetails {
  provider: string;
  model?: string;
  classifications: string[];
  highestRisk: string | null;
  detectionCount: number;
  riskScore: number;
  riskLevel: string;
}

/** データ漏洩検出イベント詳細 */
interface DataExfiltrationDetectedDetails {
  targetUrl: string;
  targetDomain: string;
  method: string;
  bodySize: number;
  initiator: string;
  pageUrl: string;
}

/** 認証情報窃取リスクイベント詳細 */
interface CredentialTheftRiskDetails {
  formAction: string;
  targetDomain: string;
  method: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
  pageUrl: string;
}

/** サプライチェーンリスクイベント詳細 */
interface SupplyChainRiskDetails {
  url: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
  pageUrl: string;
}

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
  return newEvent;
}

const extensionNetworkService = createExtensionNetworkService({
  logger,
  getStorage,
  setStorage,
  getOrInitParquetStore,
  addEvent: (event) => addEvent(event as NewEvent),
  getAlertManager,
  getRuntimeId: () => chrome.runtime.id,
});

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

      // Fire NRD alert
      await getAlertManager().alertNRD({
        domain: result.domain,
        domainAge: result.domainAge,
        registrationDate: result.registrationDate,
        confidence: result.confidence,
      });
    }

    // Log detection result to ParquetStore
    const store = await getOrInitParquetStore();
    const record = nrdResultToParquetRecord(result);
    await store.write("nrd-detections", [record]);

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

      // Fire typosquat alert
      await getAlertManager().alertTyposquat({
        domain: result.domain,
        homoglyphCount: result.heuristics.homoglyphs.length,
        confidence: result.confidence,
      });
    }

    // Log detection result to ParquetStore
    const store = await getOrInitParquetStore();
    const record = typosquatResultToParquetRecord(result);
    await store.write("typosquat-detections", [record]);

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

async function getNetworkMonitorConfig(): Promise<NetworkMonitorConfig> {
  return extensionNetworkService.getNetworkMonitorConfig();
}

async function setNetworkMonitorConfig(newConfig: NetworkMonitorConfig): Promise<{ success: boolean }> {
  return extensionNetworkService.setNetworkMonitorConfig(newConfig);
}

async function initExtensionMonitor() {
  await extensionNetworkService.initExtensionMonitor();
}

async function flushNetworkRequestBuffer() {
  await extensionNetworkService.flushNetworkRequestBuffer();
}

/**
 * DNRマッチルールを定期チェック
 * Chrome DNR APIのレート制限（10分間に最大20回）に対応するため、
 * 36秒間隔の別アラームで実行する
 *
 * 注意: checkDNRMatches()内でglobalCallbacksが呼ばれ、
 * onRequestコールバック経由でバッファ追加とイベント追加が自動的に行われる
 */
async function checkDNRMatchesHandler() {
  await extensionNetworkService.checkDNRMatchesHandler();
}
async function analyzeExtensionRisks(): Promise<void> {
  await extensionNetworkService.analyzeExtensionRisks();
}

async function getExtensionRiskAnalysis(extensionId: string) {
  return extensionNetworkService.getExtensionRiskAnalysis(extensionId);
}

async function getAllExtensionRisks() {
  return extensionNetworkService.getAllExtensionRisks();
}

async function getNetworkRequests(options?: {
  limit?: number;
  offset?: number;
  since?: number;
  initiatorType?: "extension" | "page" | "browser" | "unknown";
}) {
  return extensionNetworkService.getNetworkRequests(options);
}

async function getExtensionRequests(options?: { limit?: number; offset?: number }) {
  return extensionNetworkService.getExtensionRequests(options);
}

function getKnownExtensions() {
  return extensionNetworkService.getKnownExtensions();
}

async function getExtensionStats(): Promise<ExtensionStats> {
  return extensionNetworkService.getExtensionStats();
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
    const cutoffMs = cutoffDate.getTime();

    const client = await ensureApiClient();

    // Delete old CSP reports from database
    const deleted = await client.deleteOldReports(cutoffTimestamp);

    // Delete old events from Parquet storage
    const store = await getOrInitParquetStore();
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
    await store.deleteOldReports(cutoffDateStr);

    // Delete old AI prompts from storage
    const storage = await getStorage();
    const aiPrompts = storage.aiPrompts || [];
    const filteredPrompts = aiPrompts.filter(p => p.timestamp >= cutoffMs);
    if (filteredPrompts.length < aiPrompts.length) {
      await setStorage({ aiPrompts: filteredPrompts });
    }

    // Network requests are stored in Parquet with automatic retention

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
// Blocking Config
// ============================================================================

async function getBlockingConfig(): Promise<BlockingConfig> {
  const storage = await getStorage();
  return storage.blockingConfig || DEFAULT_BLOCKING_CONFIG;
}

async function setBlockingConfig(newConfig: BlockingConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ blockingConfig: newConfig });
    return { success: true };
  } catch (error) {
    logger.error("Error setting blocking config:", error);
    return { success: false };
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

// ============================================================================
// Notification Config
// ============================================================================

async function getNotificationConfig(): Promise<NotificationConfig> {
  const storage = await initStorage();
  return storage.notificationConfig || DEFAULT_NOTIFICATION_CONFIG;
}

async function setNotificationConfig(
  newConfig: Partial<NotificationConfig>
): Promise<{ success: boolean }> {
  const current = await getNotificationConfig();
  const updated = { ...current, ...newConfig };
  await saveStorage({ notificationConfig: updated });
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
    const isNewDomain = !storage.services[domain];
    const existing = storage.services[domain] || createDefaultService(domain);

    storage.services[domain] = {
      ...existing,
      ...update,
    };

    await saveStorage({ services: storage.services });

    // Check domain policy for new domains
    if (isNewDomain) {
      checkDomainPolicy(domain).catch(() => {
        // Ignore policy check errors
      });
    }
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
  });
}

interface CookieBannerResult {
  found: boolean;
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectedDetails;
  privacy: DetectionResult;
  tos: DetectionResult;
  cookiePolicy?: DetectionResult;
  cookieBanner?: CookieBannerResult;
  faviconUrl?: string | null;
}

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, tos, cookiePolicy, cookieBanner, timestamp, faviconUrl } = analysis;
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

  // Cookie policy detection
  if (cookiePolicy?.found && cookiePolicy.url) {
    await addEvent({
      type: "cookie_policy_found",
      domain,
      timestamp,
      details: { url: cookiePolicy.url, method: cookiePolicy.method },
    });
  }

  // Cookie banner detection
  if (cookieBanner?.found) {
    await addEvent({
      type: "cookie_banner_detected",
      domain,
      timestamp,
      details: {
        selector: cookieBanner.selector,
        hasAcceptButton: cookieBanner.hasAcceptButton,
        hasRejectButton: cookieBanner.hasRejectButton,
        hasSettingsButton: cookieBanner.hasSettingsButton,
        isGDPRCompliant: cookieBanner.isGDPRCompliant,
      },
    });
  }

  // Compliance alert - check for missing required policies on login pages
  const hasLoginForm = login.hasPasswordInput || login.isLoginUrl;
  const hasPrivacyPolicy = privacy.found;
  const hasTermsOfService = tos.found;
  const hasCookiePolicy = cookiePolicy?.found ?? false;
  const hasCookieBanner = cookieBanner?.found ?? false;
  const isCookieBannerGDPRCompliant = cookieBanner?.isGDPRCompliant ?? false;

  // Only create compliance alert if there are potential violations
  const hasViolations =
    (hasLoginForm && (!hasPrivacyPolicy || !hasTermsOfService)) ||
    !hasCookiePolicy ||
    !hasCookieBanner ||
    (hasCookieBanner && !isCookieBannerGDPRCompliant);

  if (hasViolations) {
    await getAlertManager().alertCompliance({
      pageDomain: domain,
      hasPrivacyPolicy,
      hasTermsOfService,
      hasCookiePolicy,
      hasCookieBanner,
      isCookieBannerGDPRCompliant,
      hasLoginForm,
    });
  }
}

const securityEventHandlers = createSecurityEventHandlers({
  addEvent: (event) => addEvent(event as NewEvent),
  getAlertManager,
  extractDomainFromUrl,
  checkDataTransferPolicy,
  logger,
});

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

const cspReportingService = createCSPReportingService({
  logger,
  ensureApiClient,
  initStorage,
  saveStorage: async (data) => saveStorage(data),
  addEvent: async (event) => addEvent(event as NewEvent),
  devReportEndpoint: DEV_REPORT_ENDPOINT,
});

const aiPromptMonitorService = createAIPromptMonitorService({
  defaultDetectionConfig: DEFAULT_DETECTION_CONFIG,
  getStorage,
  setStorage,
  clearAIPrompts,
  queueStorageOperation,
  addEvent: async (event) => addEvent(event as NewEvent),
  updateService: async (domain, update) => updateService(domain, update as Partial<DetectedService>),
  checkAIServicePolicy,
  getAlertManager,
});

async function clearAllData(): Promise<{ success: boolean }> {
  try {
    logger.info("Clearing all data...");

    // 1. Clear report queue
    cspReportingService.clearReportQueue();

    // 2. Clear API client reports
    if (apiClient) {
      await apiClient.clearReports();
    }

    // 3. Clear all IndexedDB databases via offscreen document
    try {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        type: "CLEAR_ALL_INDEXEDDB",
        id: crypto.randomUUID(),
      });
    } catch (error) {
      logger.warn("Error clearing IndexedDB:", error);
      // Continue even if IndexedDB clear fails
    }

    // 4. Clear chrome.storage.local and reset to defaults (preserve theme)
    await clearAllStorage({ preserveTheme: true });

    logger.info("All data cleared successfully");
    return { success: true };
  } catch (error) {
    logger.error("Error clearing all data:", error);
    return { success: false };
  }
}

async function getConnectionConfig(): Promise<{ mode: ConnectionMode; endpoint: string | null }> {
  const client = await ensureApiClient();
  return {
    mode: client.getMode(),
    endpoint: client.getEndpoint(),
  };
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
  const manager = await ensureSyncManager();
  return {
    enabled: manager.isEnabled(),
    endpoint: manager.getRemoteEndpoint(),
  };
}

async function setSyncConfig(
  enabled: boolean,
  endpoint?: string
): Promise<{ success: boolean }> {
  try {
    const manager = await ensureSyncManager();
    await manager.setEnabled(enabled, endpoint);
    return { success: true };
  } catch (error) {
    logger.error("Error setting sync config:", error);
    return { success: false };
  }
}

async function triggerSync(): Promise<{ success: boolean; sent: number; received: number }> {
  try {
    const manager = await ensureSyncManager();
    const result = await manager.sync();
    return { success: true, ...result };
  } catch (error) {
    logger.error("Error triggering sync:", error);
    return { success: false, sent: 0, received: 0 };
  }
}

// Main world script is now registered statically via manifest.json content_scripts
// Dynamic registration removed to avoid caching issues

const handleDebugBridgeForward = createDebugBridgeHandler({
  getOrInitParquetStore,
  getDoHMonitorConfig,
  setDoHMonitorConfig,
  getDoHRequests,
});

function initializeDebugBridge(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  void import("../lib/debug-bridge.js").then(({ initDebugBridge }) => {
    initDebugBridge();
  });
}

async function initializeEventStore(): Promise<void> {
  await getOrInitParquetStore();
  logger.info("EventStore initialized");
}

async function initializeApiClientWithMigration(): Promise<void> {
  const client = await getApiClient();
  apiClient = client;

  const needsMigration = await checkMigrationNeeded();
  if (needsMigration) {
    await migrateToDatabase();
  }
}

async function initializeSyncManagerWithAutoStart(): Promise<void> {
  const manager = await getSyncManager();
  syncManager = manager;
  if (manager.isEnabled()) {
    await manager.startSync();
  }
}

async function initializeEnterpriseManagedFlow(): Promise<void> {
  const enterpriseManager = await getEnterpriseManager();
  const status = enterpriseManager.getStatus();

  if (!status.isManaged) {
    return;
  }

  logger.info("Enterprise managed mode detected", {
    ssoRequired: status.ssoRequired,
    settingsLocked: status.settingsLocked,
  });

  if (!status.ssoRequired) {
    return;
  }

  const ssoManager = await getSSOManager();
  const ssoStatus = await ssoManager.getStatus();

  if (ssoStatus.isAuthenticated) {
    return;
  }

  logger.info("SSO required but not authenticated - prompting user");

  await chrome.notifications.create("sso-required", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon-128.png"),
    title: "認証が必要です",
    message: "組織のセキュリティポリシーにより、シングルサインオンでの認証が必要です。",
    priority: 2,
    requireInteraction: true,
  });

  const dashboardUrl = chrome.runtime.getURL("dashboard.html#auth");
  await chrome.tabs.create({ url: dashboardUrl, active: true });
}

async function initializeCSPReporter(): Promise<void> {
  await cspReportingService.initializeReporter();
}

async function migrateLegacyEventsIfNeeded(): Promise<void> {
  const needsMigration = await checkEventsMigrationNeeded();
  if (!needsMigration) {
    return;
  }

  const store = await getOrInitParquetStore();
  const result = await migrateEventsToIndexedDB(store);
  logger.info(`Event migration: ${result.success ? "success" : "failed"}`, result);
}

function initializeBackgroundServices(): void {
  initializeDebugBridge();

  void initializeEventStore().catch((error) => logger.error("EventStore init failed:", error));
  void initializeApiClientWithMigration().catch((error) => logger.debug("API client init failed:", error));
  void initializeSyncManagerWithAutoStart().catch((error) => logger.debug("Sync manager init failed:", error));
  void initializeEnterpriseManagedFlow().catch((error) => logger.error("Enterprise manager init failed:", error));
  void initializeCSPReporter().catch((error) => logger.error("CSP reporter init failed:", error));
  void migrateLegacyEventsIfNeeded().catch((error) => logger.error("Event migration error:", error));
  void initExtensionMonitor()
    .then(() => logger.info("Extension monitor initialization completed"))
    .catch((error) => logger.error("Extension monitor init failed:", error));
}

function registerRecurringAlarms(): void {
  // ServiceWorker keep-alive用のalarm（30秒ごとにwake-up）
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
  chrome.alarms.create("flushNetworkRequests", { periodInMinutes: 0.1 });
  // DNR API rate limit対応: 36秒間隔（Chrome制限: 10分間に最大20回、30秒以上の間隔）
  chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
  // Extension risk analysis (runs every 5 minutes)
  chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
  // Data cleanup alarm (runs once per day)
  chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });
}

export default defineBackground(() => {
  // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
  registerExtensionMonitorListener();
  registerDoHMonitorListener();
  // Main world script (ai-hooks.js) is registered statically via manifest.json content_scripts

  initializeBackgroundServices();
  registerRecurringAlarms();

  const alarmHandlers = createAlarmHandlersModule({
    logger,
    flushReportQueue: () => cspReportingService.flushReportQueue(),
    flushNetworkRequestBuffer,
    checkDNRMatchesHandler,
    analyzeExtensionRisks,
    cleanupOldData,
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
      return;
    }
    const handler = alarmHandlers.get(alarm.name);
    if (handler) {
      handler();
    }
  });

  const runtimeHandlers = createRuntimeMessageHandlersModule({
    logger,
    fallbacks: {
      cspConfig: DEFAULT_CSP_CONFIG,
      detectionConfig: DEFAULT_DETECTION_CONFIG,
      aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
      nrdConfig: DEFAULT_NRD_CONFIG,
      typosquatConfig: DEFAULT_TYPOSQUAT_CONFIG,
      networkMonitorConfig: DEFAULT_NETWORK_MONITOR_CONFIG,
      dataRetentionConfig: DEFAULT_DATA_RETENTION_CONFIG,
      blockingConfig: DEFAULT_BLOCKING_CONFIG,
      notificationConfig: DEFAULT_NOTIFICATION_CONFIG,
      doHMonitorConfig: DEFAULT_DOH_MONITOR_CONFIG,
    },
    handleDebugBridgeForward,
    getKnownExtensions,
    handlePageAnalysis: async (payload) => handlePageAnalysis(payload as PageAnalysis),
    handleCSPViolation: (data, sender) => cspReportingService.handleCSPViolation(data as Omit<CSPViolation, "type">, sender),
    handleNetworkRequest: (data, sender) => cspReportingService.handleNetworkRequest(data as Omit<NetworkRequest, "type">, sender),
    handleDataExfiltration: (data, sender) => securityEventHandlers.handleDataExfiltration(data as DataExfiltrationData, sender),
    handleCredentialTheft: (data, sender) => securityEventHandlers.handleCredentialTheft(data as CredentialTheftData, sender),
    handleSupplyChainRisk: (data, sender) => securityEventHandlers.handleSupplyChainRisk(data as SupplyChainRiskData, sender),
    handleTrackingBeacon: (data, sender) => securityEventHandlers.handleTrackingBeacon(data as TrackingBeaconData, sender),
    handleClipboardHijack: (data, sender) => securityEventHandlers.handleClipboardHijack(data as ClipboardHijackData, sender),
    handleCookieAccess: (data, sender) => securityEventHandlers.handleCookieAccess(data as CookieAccessData, sender),
    handleXSSDetected: (data, sender) => securityEventHandlers.handleXSSDetected(data as XSSDetectedData, sender),
    handleDOMScraping: (data, sender) => securityEventHandlers.handleDOMScraping(data as DOMScrapingData, sender),
    handleSuspiciousDownload: (data, sender) => securityEventHandlers.handleSuspiciousDownload(data as SuspiciousDownloadData, sender),
    getCSPReports: cspReportingService.getCSPReports,
    generateCSPPolicy: cspReportingService.generateCSPPolicy,
    generateCSPPolicyByDomain: cspReportingService.generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy: cspReportingService.saveGeneratedCSPPolicy,
    getCSPConfig: cspReportingService.getCSPConfig,
    setCSPConfig: cspReportingService.setCSPConfig,
    clearCSPData: cspReportingService.clearCSPData,
    clearAllData,
    getStats: async () => {
      const client = await ensureApiClient();
      return client.getStats();
    },
    getConnectionConfig,
    setConnectionConfig,
    getSyncConfig,
    setSyncConfig,
    triggerSync,
    getSSOManager,
    getEnterpriseManager,
    getDetectionConfig,
    setDetectionConfig,
    handleAIPromptCaptured: (payload) => aiPromptMonitorService.handleAIPromptCaptured(payload as CapturedAIPrompt),
    getAIPrompts: aiPromptMonitorService.getAIPrompts,
    getAIPromptsCount: aiPromptMonitorService.getAIPromptsCount,
    getAIMonitorConfig: aiPromptMonitorService.getAIMonitorConfig,
    setAIMonitorConfig: aiPromptMonitorService.setAIMonitorConfig,
    clearAIData: aiPromptMonitorService.clearAIData,
    handleNRDCheck,
    getNRDConfig,
    setNRDConfig,
    handleTyposquatCheck,
    getTyposquatConfig,
    setTyposquatConfig,
    getOrInitParquetStore,
    getNetworkRequests,
    getExtensionRequests,
    getExtensionStats,
    getNetworkMonitorConfig,
    setNetworkMonitorConfig,
    getAllExtensionRisks,
    getExtensionRiskAnalysis,
    analyzeExtensionRisks,
    getDataRetentionConfig,
    setDataRetentionConfig,
    cleanupOldData,
    getBlockingConfig,
    setBlockingConfig,
    getNotificationConfig,
    setNotificationConfig,
    getDoHMonitorConfig,
    setDoHMonitorConfig,
    getDoHRequests,
  });
  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage;
    const type = typeof message.type === "string" ? message.type : "";

    if (!type) {
      logger.warn("Unknown message type:", message.type);
      return false;
    }

    const directHandler = runtimeHandlers.direct.get(type);
    if (directHandler) {
      return directHandler(message, sender, sendResponse);
    }

    const asyncHandler = runtimeHandlers.async.get(type);
    if (asyncHandler) {
      return runAsyncMessageHandlerModule(logger, asyncHandler, message, sender, sendResponse);
    }

    logger.warn("Unknown message type:", type);
    return false;
  });

  // Initialize DoH Monitor
  doHMonitor = createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
  doHMonitor.start().catch((err) => logger.error("Failed to start DoH monitor:", err));

  doHMonitor.onRequest(async (record: DoHRequestRecord) => {
    try {
      const storage = await getStorage();
      if (!storage.doHRequests) {
        storage.doHRequests = [];
      }
      storage.doHRequests.push(record);

      // Keep only recent requests
      const maxRequests = storage.doHMonitorConfig?.maxStoredRequests ?? 1000;
      if (storage.doHRequests.length > maxRequests) {
        storage.doHRequests = storage.doHRequests.slice(-maxRequests);
      }

      await setStorage(storage);
      logger.debug("DoH request stored:", record.domain);

      const config = storage.doHMonitorConfig ?? DEFAULT_DOH_MONITOR_CONFIG;
      if (config.action === "alert" || config.action === "block") {
        await chrome.notifications.create(`doh-${record.id}`, {
          type: "basic",
          iconUrl: "icon-128.png",
          title: "DoH Traffic Detected",
          message: `DNS over HTTPS request to ${record.domain} (${record.detectionMethod})`,
          priority: 0,
        });
      }
    } catch (error) {
      logger.error("Failed to store DoH request:", error);
    }
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
});
