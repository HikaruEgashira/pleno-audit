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
  analyzePrompt,
  classifyProvider,
  isShadowAI,
  getProviderInfo,
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
  type EnterpriseStatus,
} from "@pleno-audit/extension-runtime";

const logger = createLogger("background");
import type { ExtensionRequestDetails } from "@pleno-audit/detectors";
import {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
} from "@pleno-audit/storage";
import { ParquetStore, nrdResultToParquetRecord, typosquatResultToParquetRecord, networkRequestRecordToParquetRecord, parquetRecordToNetworkRequestRecord } from "@pleno-audit/parquet-storage";
import {
  createAlertManager,
  createPolicyManager,
  DEFAULT_POLICY_CONFIG,
  type AlertManager,
  type SecurityAlert,
  type PolicyManager,
  type PolicyConfig,
} from "@pleno-audit/alerts";

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

  if (result.violations.length > 0) {
    const am = getAlertManager();
    for (const violation of result.violations) {
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
}

async function checkAIServicePolicy(params: {
  domain: string;
  provider?: string;
  dataTypes?: string[];
}): Promise<void> {
  const pm = await getPolicyManager();
  const result = pm.checkAIService(params);

  if (result.violations.length > 0) {
    const am = getAlertManager();
    for (const violation of result.violations) {
      await am.alertPolicyViolation({
        domain: params.domain,
        ruleId: violation.ruleId,
        ruleName: violation.ruleName,
        ruleType: violation.ruleType,
        action: violation.action,
        matchedPattern: violation.matchedPattern,
        target: violation.target,
      });
    }
  }
}

async function checkDataTransferPolicy(params: {
  destination: string;
  sizeKB: number;
}): Promise<void> {
  const pm = await getPolicyManager();
  const result = pm.checkDataTransfer(params);

  if (result.violations.length > 0) {
    const am = getAlertManager();
    for (const violation of result.violations) {
      await am.alertPolicyViolation({
        domain: params.destination,
        ruleId: violation.ruleId,
        ruleName: violation.ruleName,
        ruleType: violation.ruleType,
        action: violation.action,
        matchedPattern: violation.matchedPattern,
        target: violation.target,
      });
    }
  }
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
    if (!parquetStore) {
      parquetStore = new ParquetStore();
      await parquetStore.init();
    }
    const record = nrdResultToParquetRecord(result);
    await parquetStore.write("nrd-detections", [record]);

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
    if (!parquetStore) {
      parquetStore = new ParquetStore();
      await parquetStore.init();
    }
    const record = typosquatResultToParquetRecord(result);
    await parquetStore.write("typosquat-detections", [record]);

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

interface ExtensionCompatRequest {
  id: string;
  extensionId: string;
  extensionName: string;
  timestamp: number;
  url: string;
  method: string;
  resourceType: string;
  domain: string;
  detectedBy: NetworkRequestRecord["detectedBy"];
}

function toExtensionCompatRequest(record: NetworkRequestRecord): ExtensionCompatRequest | null {
  if (!record.extensionId) return null;
  return {
    id: record.id,
    extensionId: record.extensionId,
    extensionName: record.extensionName || "Unknown",
    timestamp: record.timestamp,
    url: record.url,
    method: record.method,
    resourceType: record.resourceType,
    domain: record.domain,
    detectedBy: record.detectedBy,
  };
}

function groupRequestsByExtension(requests: NetworkRequestRecord[]): Map<string, NetworkRequestRecord[]> {
  const grouped = new Map<string, NetworkRequestRecord[]>();
  for (const request of requests) {
    if (!request.extensionId) continue;
    const existing = grouped.get(request.extensionId);
    if (existing) {
      existing.push(request);
      continue;
    }
    grouped.set(request.extensionId, [request]);
  }
  return grouped;
}

async function getExtensionNetworkRequests(limit = 10000): Promise<NetworkRequestRecord[]> {
  const result = await getNetworkRequests({ limit, initiatorType: "extension" });
  return result.requests.filter((request) => request.extensionId);
}

function toCompatRequests(requests: NetworkRequestRecord[]): ExtensionCompatRequest[] {
  const compatRequests: ExtensionCompatRequest[] = [];
  for (const request of requests) {
    const compatRequest = toExtensionCompatRequest(request);
    if (compatRequest) {
      compatRequests.push(compatRequest);
    }
  }
  return compatRequests;
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

    // Parquetから拡張機能リクエストを取得（initiatorTypeでフィルタ）
    const requests = await getExtensionNetworkRequests();
    if (requests.length === 0) return;

    // 拡張機能ごとにリクエストをグループ化
    const requestsByExtension = groupRequestsByExtension(requests);

    const manager = getCooldownManager();

    // 各拡張機能のリスク分析
    for (const [extensionId, extRequests] of requestsByExtension) {
      // クールダウンチェック（永続ストレージから取得）
      const cooldownKey = `extension:${extensionId}`;
      if (await manager.isOnCooldown(cooldownKey)) {
        continue;
      }

      // NetworkRequestRecord → ExtensionRequestRecord互換に変換
      const compatRequests = toCompatRequests(extRequests);

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
  // Parquetから拡張機能リクエストを取得（initiatorTypeでフィルタ）
  const requests = (await getExtensionNetworkRequests()).filter((request) => request.extensionId === extensionId);

  // NetworkRequestRecord → ExtensionRequestRecord互換に変換
  const compatRequests = toCompatRequests(requests);

  return analyzeInstalledExtension(extensionId, compatRequests);
}

/**
 * すべての拡張機能のリスク分析結果を取得
 */
async function getAllExtensionRisks(): Promise<ExtensionRiskAnalysis[]> {
  // Parquetから拡張機能リクエストを取得（initiatorTypeでフィルタ）
  const requests = await getExtensionNetworkRequests();

  // 拡張機能ごとにグループ化
  const requestsByExtension = groupRequestsByExtension(requests);

  const results: ExtensionRiskAnalysis[] = [];
  for (const [extensionId, extRequests] of requestsByExtension) {
    // NetworkRequestRecord → ExtensionRequestRecord互換に変換
    const compatRequests = toCompatRequests(extRequests);

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
  // Parquetから拡張機能リクエストを取得（initiatorTypeでフィルタ）
  const requests = await getExtensionNetworkRequests();

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

    if (!apiClient) {
      apiClient = await getApiClient();
    }

    // Delete old CSP reports from database
    const deleted = await apiClient.deleteOldReports(cutoffTimestamp);

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
    await alertManager.alertCompliance({
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

interface DataExfiltrationData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  targetUrl: string;
  targetDomain: string;
  method: string;
  bodySize: number;
  initiator: string;
}

async function handleDataExfiltration(
  data: DataExfiltrationData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);

  // Log the data exfiltration event
  await addEvent({
    type: "data_exfiltration_detected",
    domain: data.targetDomain,
    timestamp: Date.now(),
    details: {
      targetUrl: data.targetUrl,
      targetDomain: data.targetDomain,
      method: data.method,
      bodySize: data.bodySize,
      initiator: data.initiator,
      pageUrl: data.pageUrl,
    },
  });

  // Fire alert for data exfiltration
  await getAlertManager().alertDataExfiltration({
    sourceDomain: pageDomain,
    targetDomain: data.targetDomain,
    bodySize: data.bodySize,
    method: data.method,
    initiator: data.initiator,
  });

  logger.warn(`Data exfiltration detected (via ${data.source || "unknown"}):`, {
    from: pageDomain,
    to: data.targetDomain,
    size: `${Math.round(data.bodySize / 1024)}KB`,
    method: data.method,
  });

  // Check data transfer policy
  checkDataTransferPolicy({
    destination: data.targetDomain,
    sizeKB: Math.round(data.bodySize / 1024),
  }).catch(() => {
    // Ignore policy check errors
  });

  return { success: true };
}

interface CredentialTheftData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  formAction: string;
  targetDomain: string;
  method: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
}

async function handleCredentialTheft(
  data: CredentialTheftData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);

  // Log the credential theft risk event
  await addEvent({
    type: "credential_theft_risk",
    domain: data.targetDomain,
    timestamp: Date.now(),
    details: {
      formAction: data.formAction,
      targetDomain: data.targetDomain,
      method: data.method,
      isSecure: data.isSecure,
      isCrossOrigin: data.isCrossOrigin,
      fieldType: data.fieldType,
      risks: data.risks,
      pageUrl: data.pageUrl,
    },
  });

  // Only fire alert if there are actual risks
  if (data.risks.length > 0) {
    await getAlertManager().alertCredentialTheft({
      sourceDomain: pageDomain,
      targetDomain: data.targetDomain,
      formAction: data.formAction,
      isSecure: data.isSecure,
      isCrossOrigin: data.isCrossOrigin,
      fieldType: data.fieldType,
      risks: data.risks,
    });

    logger.warn(`Credential theft risk detected (via ${data.source || "unknown"}):`, {
      from: pageDomain,
      to: data.targetDomain,
      fieldType: data.fieldType,
      risks: data.risks.join(", "),
    });
  }

  return { success: true };
}

interface SupplyChainRiskData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  url: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
}

async function handleSupplyChainRisk(
  data: SupplyChainRiskData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const resourceDomain = extractDomainFromUrl(data.url);
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);

  // Log the supply chain risk event
  await addEvent({
    type: "supply_chain_risk",
    domain: resourceDomain,
    timestamp: Date.now(),
    details: {
      url: data.url,
      resourceType: data.resourceType,
      hasIntegrity: data.hasIntegrity,
      hasCrossorigin: data.hasCrossorigin,
      isCDN: data.isCDN,
      risks: data.risks,
      pageUrl: data.pageUrl,
    },
  });

  // Fire alert for supply chain risk
  await getAlertManager().alertSupplyChainRisk({
    pageDomain: pageDomain,
    resourceUrl: data.url,
    resourceDomain: resourceDomain,
    resourceType: data.resourceType,
    hasIntegrity: data.hasIntegrity,
    hasCrossorigin: data.hasCrossorigin,
    isCDN: data.isCDN,
    risks: data.risks,
  });

  logger.warn(`Supply chain risk detected (via ${data.source || "unknown"}):`, {
    page: pageDomain,
    resource: resourceDomain,
    type: data.resourceType,
    risks: data.risks.join(", "),
  });

  return { success: true };
}

// Tracking beacon data interface
interface TrackingBeaconData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  url: string;
  targetDomain: string;
  bodySize: number;
  initiator: string;
}

interface SecuritySignalInput {
  eventType: string;
  domain: string;
  details: Record<string, unknown>;
  alert: () => Promise<void>;
  logLevel: "debug" | "warn";
  logMessage: string;
  logContext: Record<string, unknown>;
}

async function recordSecuritySignal(input: SecuritySignalInput): Promise<{ success: boolean }> {
  await addEvent({
    type: input.eventType as any,
    domain: input.domain,
    timestamp: Date.now(),
    details: input.details as any,
  });

  await input.alert();

  if (input.logLevel === "warn") {
    logger.warn(input.logMessage, input.logContext);
  } else {
    logger.debug(input.logMessage, input.logContext);
  }

  return { success: true };
}

async function handleTrackingBeacon(
  data: TrackingBeaconData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);
  return recordSecuritySignal({
    eventType: "tracking_beacon_detected",
    domain: data.targetDomain,
    details: {
      url: data.url,
      targetDomain: data.targetDomain,
      bodySize: data.bodySize,
      initiator: data.initiator,
      pageUrl: data.pageUrl,
    },
    alert: () =>
      getAlertManager().alertTrackingBeacon({
        sourceDomain: pageDomain,
        targetDomain: data.targetDomain,
        url: data.url,
        bodySize: data.bodySize,
        initiator: data.initiator,
      }),
    logLevel: "debug",
    logMessage: `Tracking beacon detected (via ${data.source || "unknown"}):`,
    logContext: {
      from: pageDomain,
      to: data.targetDomain,
    },
  });
}

// Clipboard hijack data interface
interface ClipboardHijackData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  text: string;
  cryptoType: string;
  fullLength: number;
}

async function handleClipboardHijack(
  data: ClipboardHijackData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);
  return recordSecuritySignal({
    eventType: "clipboard_hijack_detected",
    domain: pageDomain,
    details: {
      text: data.text,
      cryptoType: data.cryptoType,
      fullLength: data.fullLength,
      pageUrl: data.pageUrl,
    },
    alert: () =>
      getAlertManager().alertClipboardHijack({
        domain: pageDomain,
        cryptoType: data.cryptoType,
        textPreview: data.text,
      }),
    logLevel: "warn",
    logMessage: `Clipboard hijack detected (via ${data.source || "unknown"}):`,
    logContext: {
      domain: pageDomain,
      cryptoType: data.cryptoType,
    },
  });
}

// Cookie access data interface
interface CookieAccessData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  readCount: number;
}

async function handleCookieAccess(
  data: CookieAccessData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);
  return recordSecuritySignal({
    eventType: "cookie_access_detected",
    domain: pageDomain,
    details: {
      readCount: data.readCount,
      pageUrl: data.pageUrl,
    },
    alert: () =>
      getAlertManager().alertCookieAccess({
        domain: pageDomain,
        readCount: data.readCount,
      }),
    logLevel: "debug",
    logMessage: `Cookie access detected (via ${data.source || "unknown"}):`,
    logContext: {
      domain: pageDomain,
    },
  });
}

// XSS detection data interface
interface XSSDetectedData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  type: string;
  payloadPreview: string;
}

async function handleXSSDetected(
  data: XSSDetectedData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);
  return recordSecuritySignal({
    eventType: "xss_detected",
    domain: pageDomain,
    details: {
      type: data.type,
      payloadPreview: data.payloadPreview,
      pageUrl: data.pageUrl,
    },
    alert: () =>
      getAlertManager().alertXSSInjection({
        domain: pageDomain,
        injectionType: data.type,
        payloadPreview: data.payloadPreview,
      }),
    logLevel: "warn",
    logMessage: `XSS detected (via ${data.source || "unknown"}):`,
    logContext: {
      domain: pageDomain,
      type: data.type,
    },
  });
}

// DOM scraping data interface
interface DOMScrapingData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  selector: string;
  callCount: number;
}

async function handleDOMScraping(
  data: DOMScrapingData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);
  return recordSecuritySignal({
    eventType: "dom_scraping_detected",
    domain: pageDomain,
    details: {
      selector: data.selector,
      callCount: data.callCount,
      pageUrl: data.pageUrl,
    },
    alert: () =>
      getAlertManager().alertDOMScraping({
        domain: pageDomain,
        selector: data.selector,
        callCount: data.callCount,
      }),
    logLevel: "debug",
    logMessage: `DOM scraping detected (via ${data.source || "unknown"}):`,
    logContext: {
      domain: pageDomain,
      callCount: data.callCount,
    },
  });
}

// Suspicious download data interface
interface SuspiciousDownloadData {
  source?: string;
  timestamp: string;
  pageUrl: string;
  type: string;
  filename: string;
  extension: string;
  url: string;
  size: number;
  mimeType: string;
}

async function handleSuspiciousDownload(
  data: SuspiciousDownloadData,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean }> {
  const pageDomain = extractDomainFromUrl(sender.tab?.url || data.pageUrl);
  return recordSecuritySignal({
    eventType: "suspicious_download_detected",
    domain: pageDomain,
    details: {
      type: data.type,
      filename: data.filename,
      extension: data.extension,
      url: data.url,
      size: data.size,
      mimeType: data.mimeType,
      pageUrl: data.pageUrl,
    },
    alert: () =>
      getAlertManager().alertSuspiciousDownload({
        domain: pageDomain,
        downloadType: data.type,
        filename: data.filename,
        extension: data.extension,
        size: data.size,
        mimeType: data.mimeType,
      }),
    logLevel: "warn",
    logMessage: `Suspicious download detected (via ${data.source || "unknown"}):`,
    logContext: {
      domain: pageDomain,
      type: data.type,
      filename: data.filename,
    },
  });
}

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

async function storeCSPReport(report: CSPReport) {
  try {
    if (!apiClient) {
      apiClient = await getApiClient();
    }
    await apiClient.postReports([report]);
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

  // PII/機密情報検出
  const analysis = analyzePrompt(data.prompt);

  // Shadow AI検出（拡張プロバイダー分類）
  const providerClassification = classifyProvider({
    modelName: data.model,
    url: data.apiEndpoint,
    responseText: data.response?.text,
  });

  const isShadowAIDetected = isShadowAI(providerClassification.provider);
  const providerInfo = getProviderInfo(providerClassification.provider);

  // Store AI prompt with enhanced provider info
  const enhancedData: CapturedAIPrompt = {
    ...data,
    provider: providerClassification.provider,
  };
  await storeAIPrompt(enhancedData);

  // Extract domain from API endpoint
  let domain = "unknown";
  try {
    domain = new URL(data.apiEndpoint).hostname;
  } catch {
    // ignore
  }

  // Add prompt sent event with Shadow AI info
  await addEvent({
    type: "ai_prompt_sent",
    domain,
    timestamp: data.timestamp,
    details: {
      provider: providerClassification.provider,
      model: data.model,
      promptPreview: getPromptPreview(data.prompt),
      contentSize: data.prompt.contentSize,
      messageCount: data.prompt.messages?.length,
      isShadowAI: isShadowAIDetected,
      providerConfidence: providerClassification.confidence,
    },
  });

  // PII/機密情報検出時のアラートとイベント記録
  if (analysis.pii.hasSensitiveData) {
    // ai_sensitive_data_detected イベントを追加
    await addEvent({
      type: "ai_sensitive_data_detected",
      domain,
      timestamp: data.timestamp,
      details: {
        provider: data.provider || "unknown",
        model: data.model,
        classifications: analysis.pii.classifications,
        highestRisk: analysis.pii.highestRisk,
        detectionCount: analysis.pii.detectionCount,
        riskScore: analysis.risk.riskScore,
        riskLevel: analysis.risk.riskLevel,
      },
    });

    // 高リスク時はアラートを発火
    if (analysis.risk.shouldAlert) {
      await getAlertManager().alertAISensitive({
        domain,
        provider: data.provider || "unknown",
        model: data.model,
        dataTypes: analysis.pii.classifications,
      });
    }
  }

  // Shadow AI検出時のアラート発火
  if (isShadowAIDetected) {
    await getAlertManager().alertShadowAI({
      domain,
      provider: providerClassification.provider,
      providerDisplayName: providerInfo.displayName,
      category: providerInfo.category,
      riskLevel: providerInfo.riskLevel,
      confidence: providerClassification.confidence,
      model: data.model,
    });
  }

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
    const provider = providerClassification.provider;
    const providers = existingProviders.includes(provider)
      ? existingProviders
      : [...existingProviders, provider];

    // Shadow AIプロバイダーの追跡
    const existingShadowProviders = existingService?.aiDetected?.shadowAIProviders || [];
    const shadowAIProviders = isShadowAIDetected && !existingShadowProviders.includes(provider)
      ? [...existingShadowProviders, provider]
      : existingShadowProviders;

    await updateService(pageDomain, {
      aiDetected: {
        hasAIActivity: true,
        lastActivityAt: data.timestamp,
        providers,
        // 機密情報検出情報を追加
        hasSensitiveData: analysis.pii.hasSensitiveData || existingService?.aiDetected?.hasSensitiveData,
        sensitiveDataTypes: analysis.pii.hasSensitiveData
          ? [...new Set([...(existingService?.aiDetected?.sensitiveDataTypes || []), ...analysis.pii.classifications])]
          : existingService?.aiDetected?.sensitiveDataTypes,
        riskLevel: analysis.risk.riskLevel === "critical" || analysis.risk.riskLevel === "high"
          ? analysis.risk.riskLevel
          : existingService?.aiDetected?.riskLevel,
        // Shadow AI情報を追加
        hasShadowAI: isShadowAIDetected || existingService?.aiDetected?.hasShadowAI,
        shadowAIProviders: shadowAIProviders.length > 0 ? shadowAIProviders : undefined,
      },
    });
  }

  // Check AI service policy
  checkAIServicePolicy({
    domain,
    provider: providerClassification.provider,
    dataTypes: analysis.pii.hasSensitiveData ? analysis.pii.classifications : undefined,
  }).catch(() => {
    // Ignore policy check errors
  });

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

// Main world script is now registered statically via manifest.json content_scripts
// Dynamic registration removed to avoid caching issues

async function handleDebugBridgeForward(
  type: string,
  data: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (type) {
      case "DEBUG_EVENTS_LIST": {
        const params = data as { limit?: number; type?: string } | undefined;
        const store = await getOrInitParquetStore();
        const result = await store.getEvents({
          limit: params?.limit || 100,
        });
        const events = result.data.map((e) => ({
          id: e.id,
          type: e.type,
          domain: e.domain,
          timestamp: e.timestamp,
          details: typeof e.details === "string" ? JSON.parse(e.details) : e.details,
        }));
        const filteredEvents = params?.type
          ? events.filter((e) => e.type === params.type)
          : events;
        return { success: true, data: filteredEvents };
      }

      case "DEBUG_EVENTS_COUNT": {
        const store = await getOrInitParquetStore();
        const result = await store.getEvents({ limit: 0 });
        return { success: true, data: result.total };
      }

      case "DEBUG_EVENTS_CLEAR": {
        const store = await getOrInitParquetStore();
        await store.clearAll();
        return { success: true };
      }

      case "DEBUG_TAB_OPEN": {
        const params = data as { url: string };
        let url = params.url;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }
        const tab = await chrome.tabs.create({ url, active: true });
        return { success: true, data: { tabId: tab.id, url: tab.url || url } };
      }

      case "DEBUG_DOH_CONFIG_GET": {
        const config = await getDoHMonitorConfig();
        return { success: true, data: config };
      }

      case "DEBUG_DOH_CONFIG_SET": {
        const params = data as Partial<DoHMonitorConfig>;
        await setDoHMonitorConfig(params);
        return { success: true };
      }

      case "DEBUG_DOH_REQUESTS": {
        const params = data as { limit?: number; offset?: number } | undefined;
        const result = await getDoHRequests(params);
        return { success: true, data: result };
      }

      default:
        return { success: false, error: `Unknown debug message type: ${type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

interface BackgroundMessage {
  type: string;
  data?: any;
  payload?: PageAnalysis;
  debugType?: string;
  debugData?: unknown;
}

type AsyncMessageHandler = (
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender
) => Promise<unknown>;

type SyncMessageHandler = (
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean;

function withMessageFallback<T>(
  type: string,
  fallback: T,
  handler: (message: BackgroundMessage, sender: chrome.runtime.MessageSender) => Promise<T>
): AsyncMessageHandler {
  return async (message, sender) => {
    try {
      return await handler(message, sender);
    } catch (error) {
      logger.debug(`Message handler failed: ${type}`, error);
      return fallback;
    }
  };
}

function normalizeEventQueryOptions(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const options: Record<string, unknown> = data ? { ...data } : {};
  if (typeof options.since === "number") {
    options.since = new Date(options.since).toISOString();
  }
  if (typeof options.until === "number") {
    options.until = new Date(options.until).toISOString();
  }
  return options;
}

async function getEventsResponse(data: Record<string, unknown> | undefined): Promise<{ events: EventLog[]; total: number; hasMore: boolean }> {
  const store = await getOrInitParquetStore();
  const result = await store.getEvents(normalizeEventQueryOptions(data));

  const events = result.data.map((event: any) => ({
    ...event,
    details: typeof event.details === "string" ? JSON.parse(event.details) : event.details,
    timestamp: new Date(event.timestamp).toISOString(),
  }));

  return { events, total: result.total, hasMore: result.hasMore };
}

async function getEventsCountResponse(data: Record<string, unknown> | undefined): Promise<{ count: number }> {
  const store = await getOrInitParquetStore();
  const result = await store.getEvents(normalizeEventQueryOptions(data));
  return { count: result.total };
}

async function getGeneratedCSPPolicyFromStorage(): Promise<GeneratedCSPByDomain | null> {
  const data = await chrome.storage.local.get("generatedCSPPolicy");
  return data.generatedCSPPolicy || null;
}

async function startSSOAuthSession(provider: string | undefined): Promise<{ success: boolean; session?: unknown; error?: string }> {
  const ssoManager = await getSSOManager();

  if (provider === "oidc") {
    const session = await ssoManager.startOIDCAuth();
    return { success: true, session };
  }
  if (provider === "saml") {
    const session = await ssoManager.startSAMLAuth();
    return { success: true, session };
  }
  return { success: false, error: "Unknown provider" };
}

function createAsyncMessageHandlers(): Record<string, AsyncMessageHandler> {
  return {
    DEBUG_BRIDGE_FORWARD: withMessageFallback(
      "DEBUG_BRIDGE_FORWARD",
      { success: false, error: "Unknown error" },
      async (message) => handleDebugBridgeForward(message.debugType || "", message.debugData)
    ),
    PAGE_ANALYZED: withMessageFallback(
      "PAGE_ANALYZED",
      { success: false },
      async (message) => {
        await handlePageAnalysis(message.payload as PageAnalysis);
        return { success: true };
      }
    ),
    CSP_VIOLATION: withMessageFallback(
      "CSP_VIOLATION",
      { success: false },
      async (message, sender) => handleCSPViolation(message.data, sender)
    ),
    NETWORK_REQUEST: withMessageFallback(
      "NETWORK_REQUEST",
      { success: false },
      async (message, sender) => handleNetworkRequest(message.data, sender)
    ),
    DATA_EXFILTRATION_DETECTED: withMessageFallback(
      "DATA_EXFILTRATION_DETECTED",
      { success: false },
      async (message, sender) => handleDataExfiltration(message.data, sender)
    ),
    CREDENTIAL_THEFT_DETECTED: withMessageFallback(
      "CREDENTIAL_THEFT_DETECTED",
      { success: false },
      async (message, sender) => handleCredentialTheft(message.data, sender)
    ),
    SUPPLY_CHAIN_RISK_DETECTED: withMessageFallback(
      "SUPPLY_CHAIN_RISK_DETECTED",
      { success: false },
      async (message, sender) => handleSupplyChainRisk(message.data, sender)
    ),
    TRACKING_BEACON_DETECTED: withMessageFallback(
      "TRACKING_BEACON_DETECTED",
      { success: false },
      async (message, sender) => handleTrackingBeacon(message.data, sender)
    ),
    CLIPBOARD_HIJACK_DETECTED: withMessageFallback(
      "CLIPBOARD_HIJACK_DETECTED",
      { success: false },
      async (message, sender) => handleClipboardHijack(message.data, sender)
    ),
    COOKIE_ACCESS_DETECTED: withMessageFallback(
      "COOKIE_ACCESS_DETECTED",
      { success: false },
      async (message, sender) => handleCookieAccess(message.data, sender)
    ),
    XSS_DETECTED: withMessageFallback(
      "XSS_DETECTED",
      { success: false },
      async (message, sender) => handleXSSDetected(message.data, sender)
    ),
    DOM_SCRAPING_DETECTED: withMessageFallback(
      "DOM_SCRAPING_DETECTED",
      { success: false },
      async (message, sender) => handleDOMScraping(message.data, sender)
    ),
    SUSPICIOUS_DOWNLOAD_DETECTED: withMessageFallback(
      "SUSPICIOUS_DOWNLOAD_DETECTED",
      { success: false },
      async (message, sender) => handleSuspiciousDownload(message.data, sender)
    ),
    GET_CSP_REPORTS: withMessageFallback(
      "GET_CSP_REPORTS",
      [],
      async (message) => getCSPReports(message.data)
    ),
    GENERATE_CSP: withMessageFallback(
      "GENERATE_CSP",
      null,
      async (message) => generateCSPPolicy(message.data?.options)
    ),
    GENERATE_CSP_BY_DOMAIN: withMessageFallback(
      "GENERATE_CSP_BY_DOMAIN",
      null,
      async (message) => generateCSPPolicyByDomain(message.data?.options)
    ),
    GET_GENERATED_CSP_POLICY: withMessageFallback(
      "GET_GENERATED_CSP_POLICY",
      null,
      async () => getGeneratedCSPPolicyFromStorage()
    ),
    REGENERATE_CSP_POLICY: withMessageFallback(
      "REGENERATE_CSP_POLICY",
      null,
      async (message) => {
        const result = await generateCSPPolicyByDomain(
          message.data?.options || { strictMode: false, includeReportUri: true }
        );
        await saveGeneratedCSPPolicy(result);
        return result;
      }
    ),
    GET_CSP_CONFIG: withMessageFallback(
      "GET_CSP_CONFIG",
      DEFAULT_CSP_CONFIG,
      async () => getCSPConfig()
    ),
    SET_CSP_CONFIG: withMessageFallback(
      "SET_CSP_CONFIG",
      { success: false },
      async (message) => setCSPConfig(message.data)
    ),
    CLEAR_CSP_DATA: withMessageFallback(
      "CLEAR_CSP_DATA",
      { success: false },
      async () => clearCSPData()
    ),
    CLEAR_ALL_DATA: withMessageFallback(
      "CLEAR_ALL_DATA",
      { success: false },
      async () => clearAllData()
    ),
    GET_STATS: withMessageFallback(
      "GET_STATS",
      { violations: 0, requests: 0, uniqueDomains: 0 },
      async () => {
        if (!apiClient) {
          apiClient = await getApiClient();
        }
        return apiClient.getStats();
      }
    ),
    GET_CONNECTION_CONFIG: withMessageFallback(
      "GET_CONNECTION_CONFIG",
      { mode: "local", endpoint: null },
      async () => getConnectionConfig()
    ),
    SET_CONNECTION_CONFIG: withMessageFallback(
      "SET_CONNECTION_CONFIG",
      { success: false },
      async (message) => setConnectionConfig(message.data.mode, message.data.endpoint)
    ),
    GET_SYNC_CONFIG: withMessageFallback(
      "GET_SYNC_CONFIG",
      { enabled: false, endpoint: null },
      async () => getSyncConfig()
    ),
    SET_SYNC_CONFIG: withMessageFallback(
      "SET_SYNC_CONFIG",
      { success: false },
      async (message) => setSyncConfig(message.data.enabled, message.data.endpoint)
    ),
    TRIGGER_SYNC: withMessageFallback(
      "TRIGGER_SYNC",
      { success: false, sent: 0, received: 0 },
      async () => triggerSync()
    ),
    GET_SSO_STATUS: withMessageFallback(
      "GET_SSO_STATUS",
      { enabled: false, isAuthenticated: false },
      async () => {
        const ssoManager = await getSSOManager();
        return ssoManager.getStatus();
      }
    ),
    START_SSO_AUTH: withMessageFallback(
      "START_SSO_AUTH",
      { success: false, error: "Auth failed" },
      async (message) => startSSOAuthSession(message.data?.provider)
    ),
    SET_SSO_ENABLED: withMessageFallback(
      "SET_SSO_ENABLED",
      { success: false },
      async (message) => {
        const ssoManager = await getSSOManager();
        if (message.data?.enabled === false) {
          await ssoManager.disableSSO();
        }
        return { success: true };
      }
    ),
    DISABLE_SSO: withMessageFallback(
      "DISABLE_SSO",
      { success: false },
      async () => {
        const ssoManager = await getSSOManager();
        await ssoManager.disableSSO();
        return { success: true };
      }
    ),
    GET_ENTERPRISE_STATUS: withMessageFallback(
      "GET_ENTERPRISE_STATUS",
      {
        isManaged: false,
        ssoRequired: false,
        settingsLocked: false,
        config: null,
      } as EnterpriseStatus,
      async () => {
        const enterpriseManager = await getEnterpriseManager();
        return enterpriseManager.getStatus();
      }
    ),
    GET_EFFECTIVE_DETECTION_CONFIG: withMessageFallback(
      "GET_EFFECTIVE_DETECTION_CONFIG",
      DEFAULT_DETECTION_CONFIG,
      async () => {
        const enterpriseManager = await getEnterpriseManager();
        const userConfig = await getDetectionConfig();
        return enterpriseManager.getEffectiveDetectionConfig(userConfig);
      }
    ),
    AI_PROMPT_CAPTURED: withMessageFallback(
      "AI_PROMPT_CAPTURED",
      { success: false },
      async (message) => handleAIPromptCaptured(message.data)
    ),
    GET_AI_PROMPTS: withMessageFallback(
      "GET_AI_PROMPTS",
      [],
      async () => getAIPrompts()
    ),
    GET_AI_PROMPTS_COUNT: withMessageFallback(
      "GET_AI_PROMPTS_COUNT",
      { count: 0 },
      async () => ({ count: await getAIPromptsCount() })
    ),
    GET_AI_MONITOR_CONFIG: withMessageFallback(
      "GET_AI_MONITOR_CONFIG",
      DEFAULT_AI_MONITOR_CONFIG,
      async () => getAIMonitorConfig()
    ),
    SET_AI_MONITOR_CONFIG: withMessageFallback(
      "SET_AI_MONITOR_CONFIG",
      { success: false },
      async (message) => setAIMonitorConfig(message.data)
    ),
    CLEAR_AI_DATA: withMessageFallback(
      "CLEAR_AI_DATA",
      { success: false },
      async () => clearAIData()
    ),
    CHECK_NRD: withMessageFallback(
      "CHECK_NRD",
      { error: true },
      async (message) => handleNRDCheck(message.data.domain)
    ),
    GET_NRD_CONFIG: withMessageFallback(
      "GET_NRD_CONFIG",
      DEFAULT_NRD_CONFIG,
      async () => getNRDConfig()
    ),
    SET_NRD_CONFIG: withMessageFallback(
      "SET_NRD_CONFIG",
      { success: false },
      async (message) => setNRDConfig(message.data)
    ),
    CHECK_TYPOSQUAT: withMessageFallback(
      "CHECK_TYPOSQUAT",
      { error: true },
      async (message) => handleTyposquatCheck(message.data.domain)
    ),
    GET_TYPOSQUAT_CONFIG: withMessageFallback(
      "GET_TYPOSQUAT_CONFIG",
      DEFAULT_TYPOSQUAT_CONFIG,
      async () => getTyposquatConfig()
    ),
    SET_TYPOSQUAT_CONFIG: withMessageFallback(
      "SET_TYPOSQUAT_CONFIG",
      { success: false },
      async (message) => setTyposquatConfig(message.data)
    ),
    GET_EVENTS: withMessageFallback(
      "GET_EVENTS",
      { events: [], total: 0, hasMore: false },
      async (message) => getEventsResponse(message.data)
    ),
    GET_EVENTS_COUNT: withMessageFallback(
      "GET_EVENTS_COUNT",
      { count: 0 },
      async (message) => getEventsCountResponse(message.data)
    ),
    CLEAR_EVENTS: withMessageFallback(
      "CLEAR_EVENTS",
      { success: false },
      async () => {
        const store = await getOrInitParquetStore();
        await store.clearAll();
        return { success: true };
      }
    ),
    GET_NETWORK_REQUESTS: withMessageFallback(
      "GET_NETWORK_REQUESTS",
      { requests: [], total: 0 },
      async (message) => getNetworkRequests(message.data)
    ),
    GET_EXTENSION_REQUESTS: withMessageFallback(
      "GET_EXTENSION_REQUESTS",
      { requests: [], total: 0 },
      async (message) => getExtensionRequests(message.data)
    ),
    GET_EXTENSION_STATS: withMessageFallback(
      "GET_EXTENSION_STATS",
      { byExtension: {}, byDomain: {}, total: 0 },
      async () => getExtensionStats()
    ),
    GET_NETWORK_MONITOR_CONFIG: withMessageFallback(
      "GET_NETWORK_MONITOR_CONFIG",
      DEFAULT_NETWORK_MONITOR_CONFIG,
      async () => getNetworkMonitorConfig()
    ),
    SET_NETWORK_MONITOR_CONFIG: withMessageFallback(
      "SET_NETWORK_MONITOR_CONFIG",
      { success: false },
      async (message) => setNetworkMonitorConfig(message.data)
    ),
    GET_ALL_EXTENSION_RISKS: withMessageFallback(
      "GET_ALL_EXTENSION_RISKS",
      [],
      async () => getAllExtensionRisks()
    ),
    GET_EXTENSION_RISK_ANALYSIS: withMessageFallback(
      "GET_EXTENSION_RISK_ANALYSIS",
      null,
      async (message) => getExtensionRiskAnalysis(message.data.extensionId)
    ),
    TRIGGER_EXTENSION_RISK_ANALYSIS: withMessageFallback(
      "TRIGGER_EXTENSION_RISK_ANALYSIS",
      { success: false },
      async () => {
        await analyzeExtensionRisks();
        return { success: true };
      }
    ),
    GET_DATA_RETENTION_CONFIG: withMessageFallback(
      "GET_DATA_RETENTION_CONFIG",
      DEFAULT_DATA_RETENTION_CONFIG,
      async () => getDataRetentionConfig()
    ),
    SET_DATA_RETENTION_CONFIG: withMessageFallback(
      "SET_DATA_RETENTION_CONFIG",
      { success: false },
      async (message) => setDataRetentionConfig(message.data)
    ),
    TRIGGER_DATA_CLEANUP: withMessageFallback(
      "TRIGGER_DATA_CLEANUP",
      { deleted: 0 },
      async () => cleanupOldData()
    ),
    GET_BLOCKING_CONFIG: withMessageFallback(
      "GET_BLOCKING_CONFIG",
      DEFAULT_BLOCKING_CONFIG,
      async () => getBlockingConfig()
    ),
    SET_BLOCKING_CONFIG: withMessageFallback(
      "SET_BLOCKING_CONFIG",
      { success: false },
      async (message) => setBlockingConfig(message.data)
    ),
    GET_DETECTION_CONFIG: withMessageFallback(
      "GET_DETECTION_CONFIG",
      DEFAULT_DETECTION_CONFIG,
      async () => getDetectionConfig()
    ),
    SET_DETECTION_CONFIG: withMessageFallback(
      "SET_DETECTION_CONFIG",
      { success: false },
      async (message) => setDetectionConfig(message.data)
    ),
    GET_NOTIFICATION_CONFIG: withMessageFallback(
      "GET_NOTIFICATION_CONFIG",
      DEFAULT_NOTIFICATION_CONFIG,
      async () => getNotificationConfig()
    ),
    SET_NOTIFICATION_CONFIG: withMessageFallback(
      "SET_NOTIFICATION_CONFIG",
      { success: false },
      async (message) => setNotificationConfig(message.data)
    ),
    GET_DOH_MONITOR_CONFIG: withMessageFallback(
      "GET_DOH_MONITOR_CONFIG",
      DEFAULT_DOH_MONITOR_CONFIG,
      async () => getDoHMonitorConfig()
    ),
    SET_DOH_MONITOR_CONFIG: withMessageFallback(
      "SET_DOH_MONITOR_CONFIG",
      { success: false },
      async (message) => setDoHMonitorConfig(message.data)
    ),
    GET_DOH_REQUESTS: withMessageFallback(
      "GET_DOH_REQUESTS",
      { requests: [], total: 0 },
      async (message) => getDoHRequests(message.data)
    ),
  };
}

const asyncMessageHandlers = createAsyncMessageHandlers();

const syncMessageHandlers: Record<string, SyncMessageHandler> = {
  PING: (_message, _sender, sendResponse) => {
    sendResponse("PONG");
    return false;
  },
  LOCAL_API_REQUEST: () => false,
  OFFSCREEN_READY: () => false,
  DEBUG_BRIDGE_CONNECTED: (_message) => {
    logger.debug("Debug bridge: connected");
    return false;
  },
  DEBUG_BRIDGE_DISCONNECTED: (_message) => {
    logger.debug("Debug bridge: disconnected");
    return false;
  },
  GET_KNOWN_EXTENSIONS: (_message, _sender, sendResponse) => {
    sendResponse(getKnownExtensions());
    return false;
  },
};

const alarmHandlers: Record<string, () => Promise<void> | void> = {
  keepAlive: () => {
    // ServiceWorkerをアクティブに保つ（何もしない）
  },
  flushCSPReports: () => flushReportQueue(),
  flushNetworkRequests: () => flushNetworkRequestBuffer(),
  checkDNRMatches: () => checkDNRMatchesHandler(),
  extensionRiskAnalysis: () => analyzeExtensionRisks(),
  dataCleanup: () => cleanupOldData(),
};

const alarmErrorMessages: Record<string, string> = {
  flushCSPReports: "Flush reports failed:",
  flushNetworkRequests: "Flush network requests failed:",
  checkDNRMatches: "DNR match check failed:",
  extensionRiskAnalysis: "Extension risk analysis failed:",
  dataCleanup: "Data cleanup failed:",
};

function initializeDebugBridge() {
  if (!import.meta.env.DEV) return;
  import("../lib/debug-bridge.js")
    .then(({ initDebugBridge }) => {
      initDebugBridge();
    })
    .catch((error) => logger.debug("Debug bridge init failed:", error));
}

function initializeEventStore() {
  getOrInitParquetStore()
    .then(() => logger.info("EventStore initialized"))
    .catch((error) => logger.error("EventStore init failed:", error));
}

function initializeApiClientWithMigration() {
  getApiClient()
    .then(async (client) => {
      apiClient = client;
      const needsMigration = await checkMigrationNeeded();
      if (needsMigration) {
        await migrateToDatabase();
      }
    })
    .catch((error) => logger.debug("API client init failed:", error));
}

function initializeSyncManagerIfNeeded() {
  getSyncManager()
    .then(async (manager) => {
      syncManager = manager;
      if (manager.isEnabled()) {
        await manager.startSync();
      }
    })
    .catch((error) => logger.debug("Sync manager init failed:", error));
}

function initializeEnterpriseManager() {
  (async () => {
    try {
      const enterpriseManager = await getEnterpriseManager();
      const status = enterpriseManager.getStatus();

      if (!status.isManaged || !status.ssoRequired) {
        return;
      }

      logger.info("Enterprise managed mode detected", {
        ssoRequired: status.ssoRequired,
        settingsLocked: status.settingsLocked,
      });

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
    } catch (error) {
      logger.error("Enterprise manager init failed:", error);
    }
  })();
}

function initializeCSPReporter() {
  getCSPConfig()
    .then((config) => {
      const endpoint =
        config.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
      cspReporter = new CSPReporter(endpoint);
    })
    .catch((error) => logger.error("CSP reporter init failed:", error));
}

function migrateLegacyEventsIfNeeded() {
  (async () => {
    try {
      const needsMigration = await checkEventsMigrationNeeded();
      if (!needsMigration) {
        return;
      }

      const store = await getOrInitParquetStore();
      const result = await migrateEventsToIndexedDB(store);
      logger.info(`Event migration: ${result.success ? "success" : "failed"}`, result);
    } catch (error) {
      logger.error("Event migration error:", error);
    }
  })();
}

function initializeExtensionMonitorSafely() {
  initExtensionMonitor()
    .then(() => logger.info("Extension monitor initialization completed"))
    .catch((error) => logger.error("Extension monitor init failed:", error));
}

function registerBackgroundAlarms() {
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
  chrome.alarms.create("flushNetworkRequests", { periodInMinutes: 0.1 });
  // DNR API rate limit対応: 36秒間隔（Chrome制限: 10分間に最大20回、30秒以上の間隔）
  chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
  // Extension risk analysis (runs every 5 minutes)
  chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
  // Data cleanup alarm (runs once per day)
  chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    const handler = alarmHandlers[alarm.name];
    if (!handler) {
      return;
    }

    Promise.resolve(handler()).catch((error) => {
      const message = alarmErrorMessages[alarm.name] || "Alarm handler failed:";
      logger.debug(message, error);
    });
  });
}

function registerRuntimeMessageHandlers() {
  chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
    const syncHandler = syncMessageHandlers[message.type];
    if (syncHandler) {
      return syncHandler(message, sender, sendResponse);
    }

    const asyncHandler = asyncMessageHandlers[message.type];
    if (!asyncHandler) {
      logger.warn("Unknown message type:", message.type);
      return false;
    }

    asyncHandler(message, sender)
      .then(sendResponse)
      .catch((error) => {
        logger.error(`Unhandled runtime message error: ${message.type}`, error);
        sendResponse(undefined);
      });
    return true;
  });
}

export default defineBackground(() => {
  // MV3 Service Worker: webRequestリスナーは起動直後に同期的に登録する必要がある
  registerExtensionMonitorListener();
  registerDoHMonitorListener();
  // Main world script (ai-hooks.js) is registered statically via manifest.json content_scripts

  initializeDebugBridge();
  initializeEventStore();
  initializeApiClientWithMigration();
  initializeSyncManagerIfNeeded();
  initializeEnterpriseManager();
  initializeCSPReporter();
  migrateLegacyEventsIfNeeded();
  initializeExtensionMonitorSafely();
  registerBackgroundAlarms();
  registerRuntimeMessageHandlers();

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
