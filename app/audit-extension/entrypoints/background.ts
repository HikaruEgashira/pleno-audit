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
  ensureOffscreenDocument,
  checkMigrationNeeded,
  migrateToDatabase,
  getSyncManager,
  getSSOManager,
  getStorage,
  setStorage,
  clearAIPrompts,
  clearAllStorage,
  createExtensionMonitor,
  registerExtensionMonitorListener,
  createLogger,
  analyzeInstalledExtension,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  createCooldownManager,
  createPersistentCooldownStorage,
  createDoHMonitor,
  registerDoHMonitorListener,
  DEFAULT_DOH_MONITOR_CONFIG,
  getEnterpriseManager,
  type ApiClient,
  type BlockingConfig,
  type ConnectionMode,
  type SyncManager,
  type QueryOptions,
  type ExtensionMonitor,
  type ExtensionMonitorConfig,
  type NetworkMonitorConfig,
  type NetworkRequestRecord,
  type DataRetentionConfig,
  type DetectionConfig,
  type ExtensionRiskAnalysis,
  type NotificationConfig,
  type CooldownManager,
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
  networkRequestRecordToParquetRecord,
  parquetRecordToNetworkRequestRecord,
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
import {
  createRuntimeMessageHandlers as createRuntimeMessageHandlersModule,
  runAsyncMessageHandler as runAsyncMessageHandlerModule,
  type RuntimeMessage,
} from "../lib/background/runtime-handlers";
import { createDebugBridgeHandler } from "../lib/background/debug-bridge-handler";
import { createAIPromptMonitorHandler } from "../lib/background/ai-prompt-monitor";
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

// CSP Policy auto-generation debounce timer
let cspGenerationTimer: ReturnType<typeof setTimeout> | null = null;

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

// Extension Monitor / Network Monitor
let extensionMonitor: ExtensionMonitor | null = null;
const networkRequestBuffer: NetworkRequestRecord[] = [];

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
  const storage = await getStorage();
  return storage.networkMonitorConfig || DEFAULT_NETWORK_MONITOR_CONFIG;
}

async function setNetworkMonitorConfig(newConfig: NetworkMonitorConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ networkMonitorConfig: newConfig });
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
    logger.error("Error setting network monitor config:", error);
    return { success: false };
  }
}

async function initExtensionMonitor() {
  const networkConfig = await getNetworkMonitorConfig();
  if (!networkConfig.enabled) return;

  // NetworkMonitorConfig → ExtensionMonitorConfig に変換
  const config: ExtensionMonitorConfig = {
    enabled: networkConfig.enabled,
    excludeOwnExtension: networkConfig.excludeOwnExtension,
    excludedExtensions: networkConfig.excludedExtensions,
    maxStoredRequests: 10000, // Parquetに保存するため固定値
  };

  const ownId = chrome.runtime.id;
  extensionMonitor = createExtensionMonitor(config, ownId);

  extensionMonitor.onRequest(async (record) => {
    // Parquetに保存（Network Monitor統合）
    networkRequestBuffer.push(record as NetworkRequestRecord);

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
        initiatorType: (record as NetworkRequestRecord).initiatorType,
      },
    });
  });

  await extensionMonitor.start();
  logger.info("Extension monitor started");
}

async function flushNetworkRequestBuffer() {
  if (networkRequestBuffer.length === 0) return;

  const toFlush = networkRequestBuffer.splice(0, networkRequestBuffer.length);
  try {
    const store = await getOrInitParquetStore();
    const records = toFlush.map(r => networkRequestRecordToParquetRecord(r));
    await store.appendRows("network-requests", records);
  } catch (error) {
    // 失敗時は次回フラッシュに回すために再キューイング
    networkRequestBuffer.unshift(...toFlush);
    logger.error("Failed to flush network requests to Parquet:", error);
  }
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
  if (!extensionMonitor) return;
  try {
    await extensionMonitor.checkDNRMatches();
  } catch (err) {
    logger.debug("DNR match check failed:", err);
  }
}

// クールダウン定数
const EXTENSION_ALERT_COOLDOWN_MS = 1000 * 60 * 60; // 1時間

/**
 * クールダウンマネージャー（永続ストレージ使用）
 * Service Worker再起動後もクールダウン状態を維持
 */
let cooldownManager: CooldownManager | null = null;

function getCooldownManager(): CooldownManager {
  if (!cooldownManager) {
    const storage = createPersistentCooldownStorage(
      async () => {
        const data = await getStorage();
        return { alertCooldown: data.alertCooldown };
      },
      async (data) => {
        await setStorage({ alertCooldown: data.alertCooldown });
      }
    );
    cooldownManager = createCooldownManager(storage, {
      defaultCooldownMs: EXTENSION_ALERT_COOLDOWN_MS,
    });
  }
  return cooldownManager;
}

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

async function getExtensionInitiatedRequests(limit = 10000): Promise<NetworkRequestRecord[]> {
  const result = await getNetworkRequests({ limit, initiatorType: "extension" });
  return result.requests.filter((request) => request.extensionId);
}

/**
 * インストールされている拡張機能のリスク分析を実行
 */
async function analyzeExtensionRisks(): Promise<void> {
  try {
    const storage = await getStorage();
    const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

    if (!detectionConfig.enableExtension) {
      return;
    }

    const requests = await getExtensionInitiatedRequests();
    if (requests.length === 0) return;

    const manager = getCooldownManager();

    // 各拡張機能のリスク分析
    for (const [extensionId, extRequests] of groupRequestsByExtensionId(requests)) {
      // クールダウンチェック（永続ストレージから取得）
      const cooldownKey = `extension:${extensionId}`;
      if (await manager.isOnCooldown(cooldownKey)) {
        continue;
      }

      const compatRequests = extRequests.map(mapToExtensionAnalysisRequest);

      const analysis = await analyzeInstalledExtension(extensionId, compatRequests);
      if (!analysis) continue;

      // 危険な拡張機能を検出したらアラート
      if (analysis.riskLevel === "critical" || analysis.riskLevel === "high") {
        const uniqueDomains = [...new Set(extRequests.map(r => r.domain))];
        await getAlertManager().alertExtension({
          extensionId: analysis.extensionId,
          extensionName: analysis.extensionName,
          riskLevel: analysis.riskLevel,
          riskScore: analysis.riskScore,
          flags: analysis.flags.map(f => f.flag),
          requestCount: extRequests.length,
          targetDomains: uniqueDomains.slice(0, 10),
        });

        // クールダウンを永続ストレージに保存
        await manager.setCooldown(cooldownKey);
        logger.info(`Extension risk alert fired: ${analysis.extensionName} (score: ${analysis.riskScore})`);
      }
    }
  } catch (error) {
    logger.error("Extension risk analysis failed:", error);
  }
}

/**
 * 拡張機能リスク分析結果を取得
 */
async function getExtensionRiskAnalysis(extensionId: string): Promise<ExtensionRiskAnalysis | null> {
  const requests = await getExtensionInitiatedRequests();
  const compatRequests = requests
    .filter((request) => request.extensionId === extensionId)
    .map(mapToExtensionAnalysisRequest);

  return analyzeInstalledExtension(extensionId, compatRequests);
}

/**
 * すべての拡張機能のリスク分析結果を取得
 */
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

  // リスクスコア降順でソート
  return results.sort((a, b) => b.riskScore - a.riskScore);
}

async function getNetworkRequests(options?: { limit?: number; offset?: number; since?: number; initiatorType?: "extension" | "page" | "browser" | "unknown" }): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
  try {
    const store = await getOrInitParquetStore();
    const allRecords = await store.queryRows("network-requests");

    let filtered = allRecords.map(r => parquetRecordToNetworkRequestRecord(r));

    // フィルタリング（ページネーション前に適用）
    if (options?.since) {
      filtered = filtered.filter(r => r.timestamp >= options.since!);
    }
    if (options?.initiatorType) {
      filtered = filtered.filter(r => r.initiatorType === options.initiatorType);
    }

    // 新しいものから順に並び替え
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 500;
    const sliced = filtered.slice(offset, offset + limit);

    return { requests: sliced, total };
  } catch (error) {
    logger.error("Failed to query network requests:", error);
    return { requests: [], total: 0 };
  }
}

async function getExtensionRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: NetworkRequestRecord[]; total: number }> {
  // initiatorTypeフィルタを使用してページネーション前にフィルタリング
  return getNetworkRequests({
    limit: options?.limit || 500,
    offset: options?.offset || 0,
    initiatorType: "extension",
  });
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
  const requests = await getExtensionInitiatedRequests();

  const byExtension: Record<string, { name: string; count: number; domains: Set<string> }> = {};
  const byDomain: Record<string, { count: number; extensions: Set<string> }> = {};

  for (const req of requests) {
    if (!req.extensionId) continue;
    // By extension
    if (!byExtension[req.extensionId]) {
      byExtension[req.extensionId] = { name: req.extensionName || "Unknown", count: 0, domains: new Set() };
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

async function storeCSPReport(report: CSPReport) {
  try {
    const client = await ensureApiClient();
    await client.postReports([report]);
    scheduleCSPPolicyGeneration();
  } catch (error) {
    logger.error("Error storing report:", error);
  }
}

function scheduleCSPPolicyGeneration() {
  if (cspGenerationTimer) {
    clearTimeout(cspGenerationTimer);
  }

  cspGenerationTimer = setTimeout(async () => {
    try {
      const result = await generateCSPPolicyByDomain({
        strictMode: false,
        includeReportUri: true,
      });
      await saveGeneratedCSPPolicy(result);
      logger.debug("CSP policy auto-generated", { totalDomains: result.totalDomains });
    } catch (error) {
      logger.error("Error auto-generating CSP policy:", error);
    }
  }, 500);
}

async function saveGeneratedCSPPolicy(result: GeneratedCSPByDomain) {
  await chrome.storage.local.set({ generatedCSPPolicy: result });
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
    const client = await ensureApiClient();
    await client.clearReports();
    reportQueue = [];
    return { success: true };
  } catch (error) {
    logger.error("Error clearing data:", error);
    return { success: false };
  }
}

async function clearAllData(): Promise<{ success: boolean }> {
  try {
    logger.info("Clearing all data...");

    // 1. Clear report queue
    reportQueue = [];

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

function buildCSPReportsResponse(
  reports: CSPReport[],
  options: { total?: number; hasMore?: boolean; withPagination: boolean },
): CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean } {
  if (!options.withPagination) {
    return reports;
  }
  return {
    reports,
    total: options.total ?? 0,
    hasMore: options.hasMore ?? false,
  };
}

async function getCSPReports(options?: {
  type?: "csp-violation" | "network-request";
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
}): Promise<CSPReport[] | { reports: CSPReport[]; total: number; hasMore: boolean }> {
  try {
    const client = await ensureApiClient();

    const queryOptions: QueryOptions = {
      limit: options?.limit,
      offset: options?.offset,
      since: options?.since,
      until: options?.until,
    };

    const hasPaginationParams = Boolean(
      options?.limit !== undefined
      || options?.offset !== undefined
      || options?.since !== undefined
      || options?.until !== undefined,
    );

    if (options?.type === "csp-violation") {
      const result = await client.getViolations(queryOptions);
      return buildCSPReportsResponse(result.violations, {
        total: result.total,
        hasMore: result.hasMore,
        withPagination: hasPaginationParams,
      });
    }
    if (options?.type === "network-request") {
      const result = await client.getNetworkRequests(queryOptions);
      return buildCSPReportsResponse(result.requests, {
        total: result.total,
        hasMore: result.hasMore,
        withPagination: hasPaginationParams,
      });
    }

    const result = await client.getReports(queryOptions);
    return buildCSPReportsResponse(result.reports, {
      total: result.total,
      hasMore: result.hasMore,
      withPagination: hasPaginationParams,
    });
  } catch (error) {
    logger.error("Error getting CSP reports:", error);
    return [];
  }
}

async function getConnectionConfig(): Promise<{ mode: ConnectionMode; endpoint: string | null }> {
  const client = await ensureApiClient();
  return {
    mode: client.getMode(),
    endpoint: client.getEndpoint(),
  };
}

// ===== AI Prompt Monitor Functions =====

const MAX_AI_PROMPTS = 500;

const handleAIPromptCapturedModule = createAIPromptMonitorHandler({
  defaults: {
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
  },
  getStorage,
  storeAIPrompt: (prompt) => storeAIPrompt(prompt),
  addEvent: (event) => addEvent(event as unknown as NewEvent),
  updateService,
  alertAISensitive: (params) => getAlertManager().alertAISensitive(params),
  alertShadowAI: (params) => getAlertManager().alertShadowAI(params),
  checkAIServicePolicy,
});

async function handleAIPromptCaptured(
  data: CapturedAIPrompt
): Promise<{ success: boolean }> {
  return handleAIPromptCapturedModule(data);
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
  const config = await getCSPConfig();
  const endpoint = config.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
  cspReporter = new CSPReporter(endpoint);
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
    flushReportQueue,
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
    handleCSPViolation,
    handleNetworkRequest,
    handleDataExfiltration: (data, sender) => securityEventHandlers.handleDataExfiltration(data as DataExfiltrationData, sender),
    handleCredentialTheft: (data, sender) => securityEventHandlers.handleCredentialTheft(data as CredentialTheftData, sender),
    handleSupplyChainRisk: (data, sender) => securityEventHandlers.handleSupplyChainRisk(data as SupplyChainRiskData, sender),
    handleTrackingBeacon: (data, sender) => securityEventHandlers.handleTrackingBeacon(data as TrackingBeaconData, sender),
    handleClipboardHijack: (data, sender) => securityEventHandlers.handleClipboardHijack(data as ClipboardHijackData, sender),
    handleCookieAccess: (data, sender) => securityEventHandlers.handleCookieAccess(data as CookieAccessData, sender),
    handleXSSDetected: (data, sender) => securityEventHandlers.handleXSSDetected(data as XSSDetectedData, sender),
    handleDOMScraping: (data, sender) => securityEventHandlers.handleDOMScraping(data as DOMScrapingData, sender),
    handleSuspiciousDownload: (data, sender) => securityEventHandlers.handleSuspiciousDownload(data as SuspiciousDownloadData, sender),
    getCSPReports,
    generateCSPPolicy,
    generateCSPPolicyByDomain,
    saveGeneratedCSPPolicy,
    getCSPConfig,
    setCSPConfig,
    clearCSPData,
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
    handleAIPromptCaptured,
    getAIPrompts,
    getAIPromptsCount,
    getAIMonitorConfig,
    setAIMonitorConfig,
    clearAIData,
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
