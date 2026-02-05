import type {
  CookieInfo,
  CookieSetDetails,
  DetectedService,
  DetectionResult,
  EventLog,
  ExtensionRequestDetails,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  TyposquatDetectedDetails,
} from "@pleno-audit/detectors";
import { DEFAULT_CSP_CONFIG, type CSPConfig, type CSPReport, type CSPViolationDetails, type NetworkRequestDetails } from "@pleno-audit/csp";
import {
  DEFAULT_BLOCKING_CONFIG,
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  getStorage,
  setStorage,
  type ApiClient,
  type BlockingConfig,
  type ConnectionMode,
  type DataRetentionConfig,
  type DetectionConfig,
  type Logger,
  type NotificationConfig,
  type SyncManager,
  updateApiClientConfig,
  getApiClient,
  getSyncManager,
} from "@pleno-audit/extension-runtime";
import { ParquetStore } from "@pleno-audit/parquet-storage";
import {
  DEFAULT_POLICY_CONFIG,
  createAlertManager,
  createPolicyManager,
  type AlertManager,
  type PolicyConfig,
  type PolicyManager,
  type SecurityAlert,
} from "@pleno-audit/alerts";

interface StorageData {
  services: Record<string, DetectedService>;
  cspReports: CSPReport[];
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
  notificationConfig: NotificationConfig;
  policyConfig: PolicyConfig;
}

let storageQueue: Promise<void> = Promise.resolve();
let apiClient: ApiClient | null = null;
let syncManager: SyncManager | null = null;
let parquetStore: ParquetStore | null = null;
let alertManager: AlertManager | null = null;
let policyManager: PolicyManager | null = null;

type PolicyViolation = ReturnType<PolicyManager["checkDomain"]>["violations"][number];

export type NewEvent =
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
      type: "cookie_policy_found";
      domain: string;
      timestamp: number;
      details: CookiePolicyFoundDetails;
    }
  | {
      type: "cookie_banner_detected";
      domain: string;
      timestamp: number;
      details: CookieBannerDetectedDetails;
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

interface CookieBannerResult {
  found: boolean;
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

interface CookiePolicyFoundDetails {
  url: string;
  method?: string;
}

interface CookieBannerDetectedDetails {
  selector: string | null;
  hasAcceptButton: boolean;
  hasRejectButton: boolean;
  hasSettingsButton: boolean;
  isGDPRCompliant: boolean;
}

export interface PageAnalysis {
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

function generateEventId(): string {
  return crypto.randomUUID();
}

let logger: Logger | null = null;

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

  const parquetEvent = {
    id: eventId,
    type: event.type,
    domain: event.domain,
    timestamp: event.timestamp ?? Date.now(),
    details: JSON.stringify(event.details || {}),
  };

  await store.addEvents([parquetEvent]);
  return newEvent;
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

function getAlertManager(): AlertManager {
  if (!alertManager) {
    alertManager = createAlertManager({
      enabled: true,
      showNotifications: true,
      playSound: false,
      rules: [],
      severityFilter: ["critical", "high"],
    });

    alertManager.subscribe((alert: SecurityAlert) => {
      void showChromeNotification(alert);
    });
  }
  return alertManager;
}

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
    const storage = await getStorage();
    const notificationConfig = storage.notificationConfig || DEFAULT_NOTIFICATION_CONFIG;

    if (!notificationConfig.enabled) {
      logger?.debug("Notification disabled, skipping:", alert.title);
      return;
    }

    if (!notificationConfig.severityFilter.includes(alert.severity)) {
      logger?.debug("Notification filtered by severity:", alert.severity);
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
    logger?.warn("Failed to show notification:", error);
  }
}

function registerNotificationClickHandler(): void {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard.html#graph"),
    });
    chrome.notifications.clear(notificationId);
  });
}

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
    "notificationConfig",
    "policyConfig",
  ]);
  return {
    services: result.services || {},
    cspReports: result.cspReports || [],
    cspConfig: result.cspConfig || DEFAULT_CSP_CONFIG,
    detectionConfig: result.detectionConfig || DEFAULT_DETECTION_CONFIG,
    notificationConfig: result.notificationConfig || DEFAULT_NOTIFICATION_CONFIG,
    policyConfig: result.policyConfig || DEFAULT_POLICY_CONFIG,
  };
}

async function saveStorage(data: Partial<StorageData>) {
  await chrome.storage.local.set(data);
}

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

    if (isNewDomain) {
      checkDomainPolicy(domain).catch((error) => {
        logger?.warn("Failed to check domain policy:", domain, error);
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

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, tos, cookiePolicy, cookieBanner, timestamp, faviconUrl } = analysis;
  const storage = await initStorage();
  const detectionConfig = storage.detectionConfig || DEFAULT_DETECTION_CONFIG;

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

  if (cookiePolicy?.found && cookiePolicy.url) {
    await addEvent({
      type: "cookie_policy_found",
      domain,
      timestamp,
      details: { url: cookiePolicy.url, method: cookiePolicy.method },
    });
  }

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

  const hasLoginForm = login.hasPasswordInput || login.isLoginUrl;
  const hasPrivacyPolicy = privacy.found;
  const hasTermsOfService = tos.found;
  const hasCookiePolicy = cookiePolicy?.found ?? false;
  const hasCookieBanner = cookieBanner?.found ?? false;
  const isCookieBannerGDPRCompliant = cookieBanner?.isGDPRCompliant ?? false;

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

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

async function getDataRetentionConfig(): Promise<DataRetentionConfig> {
  const storage = await getStorage();
  return storage.dataRetentionConfig || DEFAULT_DATA_RETENTION_CONFIG;
}

async function setDataRetentionConfig(newConfig: DataRetentionConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ dataRetentionConfig: newConfig });
    return { success: true };
  } catch (error) {
    logger?.error("Error setting data retention config:", error);
    return { success: false };
  }
}

async function cleanupOldData(): Promise<{ deleted: number }> {
  try {
    const config = await getDataRetentionConfig();
    if (!config.autoCleanupEnabled || config.retentionDays === 0) {
      return { deleted: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();
    const cutoffMs = cutoffDate.getTime();

    const client = await ensureApiClient();
    const deleted = await client.deleteOldReports(cutoffTimestamp);

    const store = await getOrInitParquetStore();
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
    await store.deleteOldReports(cutoffDateStr);

    const storage = await getStorage();
    const aiPrompts = storage.aiPrompts || [];
    const filteredPrompts = aiPrompts.filter(p => p.timestamp >= cutoffMs);
    if (filteredPrompts.length < aiPrompts.length) {
      await setStorage({ aiPrompts: filteredPrompts });
    }

    await setStorage({
      dataRetentionConfig: {
        ...config,
        lastCleanupTimestamp: Date.now(),
      },
    });

    logger?.info(`Data cleanup completed. Deleted ${deleted} CSP reports.`);
    return { deleted };
  } catch (error) {
    logger?.error("Error during data cleanup:", error);
    return { deleted: 0 };
  }
}

async function getBlockingConfig(): Promise<BlockingConfig> {
  const storage = await getStorage();
  return storage.blockingConfig || DEFAULT_BLOCKING_CONFIG;
}

async function setBlockingConfig(newConfig: BlockingConfig): Promise<{ success: boolean }> {
  try {
    await setStorage({ blockingConfig: newConfig });
    return { success: true };
  } catch (error) {
    logger?.error("Error setting blocking config:", error);
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
    logger?.error("Error setting connection config:", error);
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
    logger?.error("Error setting sync config:", error);
    return { success: false };
  }
}

async function triggerSync(): Promise<{ success: boolean; sent: number; received: number }> {
  try {
    const manager = await ensureSyncManager();
    const result = await manager.sync();
    return { success: true, ...result };
  } catch (error) {
    logger?.error("Error triggering sync:", error);
    return { success: false, sent: 0, received: 0 };
  }
}

async function clearApiClientReportsIfInitialized(): Promise<void> {
  if (!apiClient) {
    return;
  }
  await apiClient.clearReports();
}

async function initializeApiClientWithMigration(
  checkMigrationNeeded: () => Promise<boolean>,
  migrateToDatabase: () => Promise<void>
): Promise<void> {
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

export function createBackgroundServices(serviceLogger: Logger) {
  logger = serviceLogger;
  return {
    ensureApiClient,
    ensureSyncManager,
    getOrInitParquetStore,
    addEvent,
    getAlertManager,
    getPolicyManager,
    checkDomainPolicy,
    checkAIServicePolicy,
    checkDataTransferPolicy,
    registerNotificationClickHandler,
    queueStorageOperation,
    initStorage,
    saveStorage,
    getDetectionConfig,
    setDetectionConfig,
    getNotificationConfig,
    setNotificationConfig,
    updateService,
    addCookieToService,
    handlePageAnalysis,
    extractDomainFromUrl,
    getDataRetentionConfig,
    setDataRetentionConfig,
    cleanupOldData,
    getBlockingConfig,
    setBlockingConfig,
    getConnectionConfig,
    setConnectionConfig,
    getSyncConfig,
    setSyncConfig,
    triggerSync,
    clearApiClientReportsIfInitialized,
    initializeApiClientWithMigration,
    initializeSyncManagerWithAutoStart,
  };
}
