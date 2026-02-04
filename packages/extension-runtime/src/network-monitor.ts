/**
 * Network Monitor
 *
 * 全ネットワークリクエストを監視・記録するコア機能
 * CSPと並ぶセキュリティposture（態勢）可視化のための基盤
 *
 * 監視方式:
 * 1. webRequest.onBeforeRequest - 全リクエストを検出
 * 2. declarativeNetRequest - Service Workerからのリクエスト補完（Chrome 111+）
 *
 * MV3 Service Worker対応:
 * - webRequest.onBeforeRequestリスナーは同期的にトップレベルで登録する必要がある
 * - Service Workerの再起動時にリスナーが維持されるように設計
 */

import type {
  NetworkMonitorConfig,
  NetworkRequestRecord,
  InitiatorType,
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
} from "./storage-types.js";
import { DEFAULT_NETWORK_MONITOR_CONFIG } from "./storage-types.js";
import { createLogger } from "./logger.js";
import {
  globalExtensionStatsCache,
  type DashboardStats,
} from "./extension-stats-analyzer.js";
import {
  detectAllSuspiciousPatterns,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
  type SuspiciousPattern,
} from "./suspicious-pattern-detector.js";

const logger = createLogger("network-monitor");

// 後方互換性のためのエクスポート
export const DEFAULT_EXTENSION_MONITOR_CONFIG: ExtensionMonitorConfig = {
  enabled: true,
  excludeOwnExtension: true,
  excludedExtensions: [],
  maxStoredRequests: 5000,
};

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons?: { size: number; url: string }[];
}

const EXTENSION_ID_PATTERN = /^[a-z]{32}$/;

// declarativeNetRequest用のルールID範囲
const DNR_RULE_ID_BASE = 10000;
const DNR_RULE_ID_MAX = 10100;
const DNR_RULE_CAPACITY = DNR_RULE_ID_MAX - DNR_RULE_ID_BASE;

const DNR_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
  chrome.declarativeNetRequest.ResourceType.OTHER,
  chrome.declarativeNetRequest.ResourceType.SCRIPT,
  chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
  chrome.declarativeNetRequest.ResourceType.IMAGE,
];

// DNR API レート制限対策
const DNR_QUOTA_INTERVAL_MS = 10 * 60 * 1000;
const DNR_MAX_CALLS_PER_INTERVAL = 18;
const DNR_MIN_INTERVAL_MS = 35 * 1000;

interface NetworkMonitorState {
  config: NetworkMonitorConfig;
  configCacheKey: string;
  ownExtensionId: string;
  knownExtensions: Map<string, ExtensionInfo>;
  callbacks: Array<(request: NetworkRequestRecord) => void>;
  listenerRegistered: boolean;
  dnrRulesRegistered: boolean;
  lastMatchedRulesCheck: number;
  lastDNRCallTime: number;
  dnrCallCount: number;
  dnrQuotaWindowStart: number;
  dnrRuleToExtensionMap: Map<number, string>;
  excludedDomains: Set<string>;
  excludedExtensions: Set<string>;
}

function createConfigCacheKey(config: NetworkMonitorConfig): string {
  return `${config.excludedDomains.join("\u0000")}::${config.excludedExtensions.join("\u0000")}`;
}

// グローバル状態（Service Worker再起動時に再初期化される）
const state: NetworkMonitorState = {
  config: DEFAULT_NETWORK_MONITOR_CONFIG,
  configCacheKey: createConfigCacheKey(DEFAULT_NETWORK_MONITOR_CONFIG),
  ownExtensionId: "",
  knownExtensions: new Map<string, ExtensionInfo>(),
  callbacks: [],
  listenerRegistered: false,
  dnrRulesRegistered: false,
  lastMatchedRulesCheck: 0,
  lastDNRCallTime: 0,
  dnrCallCount: 0,
  dnrQuotaWindowStart: 0,
  dnrRuleToExtensionMap: new Map<number, string>(),
  excludedDomains: new Set<string>(),
  excludedExtensions: new Set<string>(),
};

function updateConfigCaches(config: NetworkMonitorConfig): void {
  state.configCacheKey = createConfigCacheKey(config);
  state.excludedDomains = new Set(config.excludedDomains);
  state.excludedExtensions = new Set(config.excludedExtensions);
}

function ensureConfigCachesCurrent(): void {
  if (state.configCacheKey !== createConfigCacheKey(state.config)) {
    updateConfigCaches(state.config);
  }
}

function applyConfig(config: NetworkMonitorConfig): void {
  state.config = config;
  updateConfigCaches(config);
}

/**
 * グローバルコールバックをクリア
 */
export function clearGlobalCallbacks(): void {
  state.callbacks = [];
}

/**
 * initiatorからタイプを判定
 */
function classifyInitiator(initiator: string | undefined): InitiatorType {
  if (!initiator) return "browser";
  if (initiator.startsWith("chrome-extension://")) return "extension";
  if (initiator.startsWith("http://") || initiator.startsWith("https://")) {
    return "page";
  }
  return "unknown";
}

/**
 * 拡張機能IDを抽出
 */
function extractExtensionId(initiator: string): string | null {
  const match = initiator.match(/^chrome-extension:\/\/([a-z]{32})/);
  return match?.[1] ?? null;
}

/**
 * ドメインを抽出
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function emitRecord(record: NetworkRequestRecord): void {
  for (const callback of state.callbacks) {
    try {
      callback(record);
    } catch (error) {
      logger.error("Callback error:", error);
    }
  }
}

function isMonitorRuleId(ruleId: number): boolean {
  return ruleId >= DNR_RULE_ID_BASE && ruleId < DNR_RULE_ID_MAX;
}

function createDNRRule(
  extensionId: string,
  ruleId: number
): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
    },
    condition: {
      initiatorDomains: [extensionId],
      resourceTypes: DNR_RESOURCE_TYPES,
    },
  };
}

function canCheckDNRMatches(now: number): boolean {
  if (now - state.dnrQuotaWindowStart >= DNR_QUOTA_INTERVAL_MS) {
    state.dnrQuotaWindowStart = now;
    state.dnrCallCount = 0;
  }

  if (state.dnrCallCount >= DNR_MAX_CALLS_PER_INTERVAL) {
    return false;
  }

  if (now - state.lastDNRCallTime < DNR_MIN_INTERVAL_MS) {
    return false;
  }

  state.lastDNRCallTime = now;
  state.dnrCallCount++;
  return true;
}

function findRuleIdByExtensionId(extensionId: string): number | null {
  for (const [ruleId, mappedExtensionId] of state.dnrRuleToExtensionMap.entries()) {
    if (mappedExtensionId === extensionId) {
      return ruleId;
    }
  }
  return null;
}

function nextAvailableRuleId(): number | null {
  const usedRuleIds = new Set(state.dnrRuleToExtensionMap.keys());
  for (let ruleId = DNR_RULE_ID_BASE; ruleId < DNR_RULE_ID_MAX; ruleId++) {
    if (!usedRuleIds.has(ruleId)) {
      return ruleId;
    }
  }
  return null;
}

function toExtensionRequestRecords(
  records: NetworkRequestRecord[]
): ExtensionRequestRecord[] {
  return records
    .filter(
      (record): record is NetworkRequestRecord & { extensionId: string } =>
        record.initiatorType === "extension" && typeof record.extensionId === "string"
    )
    .map((record) => ({
      id: record.id,
      extensionId: record.extensionId,
      extensionName: record.extensionName || "Unknown",
      timestamp: record.timestamp,
      url: record.url,
      method: record.method,
      resourceType: record.resourceType,
      domain: record.domain,
      detectedBy: record.detectedBy,
    }));
}

/**
 * webRequestリスナーのハンドラー
 * 全ネットワークリクエストを処理
 */
function handleWebRequest(details: chrome.webRequest.WebRequestBodyDetails): void {
  ensureConfigCachesCurrent();

  if (!state.config.enabled) return;

  const initiatorType = classifyInitiator(details.initiator);
  if (!state.config.captureAllRequests && initiatorType !== "extension") {
    return;
  }

  let extensionId: string | undefined;
  let extensionName: string | undefined;

  if (initiatorType === "extension" && details.initiator) {
    extensionId = extractExtensionId(details.initiator) ?? undefined;

    if (
      state.config.excludeOwnExtension &&
      extensionId &&
      extensionId === state.ownExtensionId
    ) {
      return;
    }

    if (extensionId && state.excludedExtensions.has(extensionId)) {
      return;
    }

    extensionName = extensionId
      ? state.knownExtensions.get(extensionId)?.name
      : undefined;
  }

  const domain = extractDomain(details.url);
  if (state.excludedDomains.has(domain)) return;

  const record: NetworkRequestRecord = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    url: details.url,
    method: details.method,
    domain,
    resourceType: details.type,
    initiator: details.initiator || null,
    initiatorType,
    extensionId,
    extensionName,
    tabId: details.tabId,
    frameId: details.frameId,
    detectedBy: "webRequest",
  };

  logger.debug("Network request detected:", {
    initiatorType,
    domain,
    resourceType: details.type,
  });

  emitRecord(record);
}

/**
 * webRequestリスナーを同期的に登録
 */
export function registerNetworkMonitorListener(): void {
  if (state.listenerRegistered) {
    logger.debug("Network monitor listener already registered");
    return;
  }

  try {
    chrome.webRequest.onBeforeRequest.addListener(
      handleWebRequest,
      { urls: ["<all_urls>"] }
    );
    state.listenerRegistered = true;
    logger.info("webRequest.onBeforeRequest listener registered for all requests");
  } catch (error) {
    logger.error("Failed to register webRequest listener:", error);
  }
}

// 後方互換性: 旧関数名のエイリアス
export const registerExtensionMonitorListener = registerNetworkMonitorListener;

/**
 * DNRルールを登録
 */
export async function registerDNRRulesForExtensions(
  extensionIds: string[]
): Promise<void> {
  if (extensionIds.length === 0) {
    logger.debug("No extensions to monitor with DNR");
    return;
  }

  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((rule) => isMonitorRuleId(rule.id))
      .map((rule) => rule.id);

    const targetExtensions = extensionIds.slice(0, DNR_RULE_CAPACITY);
    const nextRuleMap = new Map<number, string>();
    const newRules = targetExtensions.map((extensionId, index) => {
      const ruleId = DNR_RULE_ID_BASE + index;
      nextRuleMap.set(ruleId, extensionId);
      return createDNRRule(extensionId, ruleId);
    });

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: newRules,
    });

    state.dnrRuleToExtensionMap = nextRuleMap;
    state.dnrRulesRegistered = true;
    logger.info(`DNR rules registered for ${newRules.length} extensions`);
  } catch (error) {
    logger.error("Failed to register DNR rules:", error);
  }
}

/**
 * DNRマッチルールをチェック
 */
export async function checkMatchedDNRRules(): Promise<NetworkRequestRecord[]> {
  ensureConfigCachesCurrent();

  if (!state.dnrRulesRegistered || !state.config.enabled) {
    return [];
  }

  const now = Date.now();
  if (!canCheckDNRMatches(now)) {
    return [];
  }

  try {
    const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({
      minTimeStamp: state.lastMatchedRulesCheck,
    });

    state.lastMatchedRulesCheck = now;
    const records: NetworkRequestRecord[] = [];

    for (const info of matchedRules.rulesMatchedInfo) {
      const ruleId = info.rule.ruleId;
      if (!isMonitorRuleId(ruleId)) {
        continue;
      }

      const extensionId = state.dnrRuleToExtensionMap.get(ruleId);
      if (!extensionId) continue;
      if (state.excludedExtensions.has(extensionId)) continue;

      const extInfo = state.knownExtensions.get(extensionId);

      const record: NetworkRequestRecord = {
        id: crypto.randomUUID(),
        timestamp: info.timeStamp,
        url: `[DNR detected - tabId: ${info.tabId}]`,
        method: "UNKNOWN",
        domain: "unknown",
        resourceType: "xmlhttprequest",
        initiator: `chrome-extension://${extensionId}`,
        initiatorType: "extension",
        extensionId,
        extensionName: extInfo?.name,
        tabId: info.tabId,
        frameId: 0,
        detectedBy: "declarativeNetRequest",
      };

      records.push(record);
      emitRecord(record);
    }

    return records;
  } catch (error) {
    const errorMessage = String(error);
    if (errorMessage.includes("quota") || errorMessage.includes("QUOTA")) {
      logger.warn("DNR quota exceeded, entering backoff mode");
      state.dnrCallCount = DNR_MAX_CALLS_PER_INTERVAL;
      return [];
    }
    logger.error("Failed to check matched DNR rules:", error);
    return [];
  }
}

/**
 * DNRルールをクリア
 */
export async function clearDNRRules(): Promise<void> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((rule) => isMonitorRuleId(rule.id))
      .map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    state.dnrRulesRegistered = false;
    state.dnrRuleToExtensionMap.clear();
    logger.debug("DNR rules cleared");
  } catch (error) {
    logger.error("Failed to clear DNR rules:", error);
  }
}

/**
 * 単一の拡張機能のDNRルールを追加
 */
export async function addDNRRuleForExtension(extensionId: string): Promise<void> {
  if (!extensionId || !EXTENSION_ID_PATTERN.test(extensionId)) {
    logger.warn(`Invalid extension ID format: ${extensionId}`);
    return;
  }

  try {
    if (findRuleIdByExtensionId(extensionId) !== null) {
      return;
    }

    const ruleId = nextAvailableRuleId();
    if (ruleId === null) {
      logger.warn(`Cannot add DNR rule for ${extensionId}: no available rule ID`);
      return;
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [createDNRRule(extensionId, ruleId)],
    });
    state.dnrRuleToExtensionMap.set(ruleId, extensionId);
    logger.info(`DNR rule ${ruleId} added for extension ${extensionId}`);
  } catch (error) {
    logger.error(`Failed to add DNR rule for ${extensionId}:`, error);
  }
}

/**
 * 拡張機能のDNRルールを削除
 */
export async function removeDNRRuleForExtension(
  extensionId: string
): Promise<void> {
  try {
    const ruleIdToRemove = findRuleIdByExtensionId(extensionId);
    if (ruleIdToRemove === null) return;

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleIdToRemove],
    });
    state.dnrRuleToExtensionMap.delete(ruleIdToRemove);
    logger.info(`DNR rule ${ruleIdToRemove} removed for extension ${extensionId}`);
  } catch (error) {
    logger.error(`Failed to remove DNR rule for ${extensionId}:`, error);
  }
}

export interface NetworkMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getKnownExtensions(): Map<string, ExtensionInfo>;
  onRequest(callback: (request: NetworkRequestRecord) => void): void;
  refreshExtensionList(): Promise<void>;
  checkDNRMatches(): Promise<NetworkRequestRecord[]>;
  generateStats(records: NetworkRequestRecord[]): DashboardStats;
  detectSuspiciousPatterns(records: NetworkRequestRecord[]): SuspiciousPattern[];
}

// 後方互換性のためのエイリアス
export type ExtensionMonitor = NetworkMonitor;

/**
 * Network Monitorを作成
 */
export function createNetworkMonitor(
  config: NetworkMonitorConfig,
  ownExtensionId: string
): NetworkMonitor {
  applyConfig(config);
  state.ownExtensionId = ownExtensionId;

  async function refreshExtensionList(): Promise<void> {
    try {
      const extensions = await chrome.management.getAll();
      state.knownExtensions.clear();
      for (const extension of extensions) {
        if (extension.type === "extension") {
          state.knownExtensions.set(extension.id, {
            id: extension.id,
            name: extension.name,
            version: extension.version,
            enabled: extension.enabled,
            icons: extension.icons,
          });
        }
      }
      logger.debug(`Extension list refreshed: ${state.knownExtensions.size} extensions`);
    } catch (error) {
      logger.warn("Failed to get extension list:", error);
    }
  }

  function handleInstalled(info: chrome.management.ExtensionInfo): void {
    if (info.type !== "extension") return;
    if (info.id === ownExtensionId) return;
    if (state.excludedExtensions.has(info.id)) return;

    refreshExtensionList().catch(() => {});
    addDNRRuleForExtension(info.id).catch(() => {});
  }

  function handleUninstalled(extensionId: string): void {
    refreshExtensionList().catch(() => {});
    removeDNRRuleForExtension(extensionId).catch(() => {});
  }

  async function restoreDNRMapping(): Promise<boolean> {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const relevantRules = existingRules.filter((rule) =>
        isMonitorRuleId(rule.id)
      );

      state.dnrRuleToExtensionMap.clear();
      let needsReconciliation = false;
      for (const rule of relevantRules) {
        if (rule.condition?.initiatorDomains?.length === 1) {
          const extensionId = rule.condition.initiatorDomains[0];
          if (!EXTENSION_ID_PATTERN.test(extensionId)) {
            needsReconciliation = true;
            continue;
          }

          if (
            (state.config.excludeOwnExtension &&
              extensionId === state.ownExtensionId) ||
            state.excludedExtensions.has(extensionId)
          ) {
            needsReconciliation = true;
            continue;
          }

          state.dnrRuleToExtensionMap.set(rule.id, extensionId);
          continue;
        }

        needsReconciliation = true;
      }

      state.dnrRulesRegistered = state.dnrRuleToExtensionMap.size > 0;
      logger.info(`DNR mapping restored: ${state.dnrRuleToExtensionMap.size} rules`);
      return needsReconciliation;
    } catch (error) {
      logger.error("Failed to restore DNR mapping:", error);
      return true;
    }
  }

  return {
    async start() {
      if (!state.config.enabled) {
        logger.debug("Network monitor disabled by config");
        return;
      }

      if (!state.listenerRegistered) {
        registerNetworkMonitorListener();
      }

      await refreshExtensionList();
      logger.info(
        `Network monitor started: capturing ${state.config.captureAllRequests ? "all" : "extension"} requests`
      );

      let mappingRestored = false;
      if (!state.dnrRulesRegistered && state.dnrRuleToExtensionMap.size === 0) {
        const needsReconciliation = await restoreDNRMapping();
        mappingRestored =
          state.dnrRuleToExtensionMap.size > 0 && !needsReconciliation;
      }

      chrome.management.onInstalled.addListener(handleInstalled);
      chrome.management.onUninstalled.addListener(handleUninstalled);

      if (!mappingRestored) {
        const otherExtensionIds = Array.from(state.knownExtensions.keys()).filter(
          (extensionId) =>
            extensionId !== ownExtensionId &&
            !state.excludedExtensions.has(extensionId)
        );
        await registerDNRRulesForExtensions(otherExtensionIds);
      }
    },

    async stop() {
      chrome.management.onInstalled.removeListener(handleInstalled);
      chrome.management.onUninstalled.removeListener(handleUninstalled);
      applyConfig({ ...state.config, enabled: false });
      clearGlobalCallbacks();
      await clearDNRRules();
    },

    getKnownExtensions: () => state.knownExtensions,

    onRequest(callback) {
      state.callbacks.push(callback);
    },

    refreshExtensionList,

    checkDNRMatches: checkMatchedDNRRules,

    generateStats(records) {
      return globalExtensionStatsCache.getStats(toExtensionRequestRecords(records));
    },

    detectSuspiciousPatterns(records) {
      return detectAllSuspiciousPatterns(
        toExtensionRequestRecords(records),
        DEFAULT_SUSPICIOUS_PATTERN_CONFIG
      );
    },
  };
}

// 後方互換性: 旧関数名のエイリアス
export function createExtensionMonitor(
  config: ExtensionMonitorConfig,
  ownExtensionId: string
): NetworkMonitor {
  // ExtensionMonitorConfig を NetworkMonitorConfig に変換
  const networkConfig: NetworkMonitorConfig = {
    enabled: config.enabled,
    captureAllRequests: false, // 後方互換: 拡張機能のみ
    excludeOwnExtension: config.excludeOwnExtension,
    excludedDomains: [],
    excludedExtensions: config.excludedExtensions,
  };
  return createNetworkMonitor(networkConfig, ownExtensionId);
}
