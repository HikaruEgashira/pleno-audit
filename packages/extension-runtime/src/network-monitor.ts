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

// declarativeNetRequest用のルールID範囲
const DNR_RULE_ID_BASE = 10000;
const DNR_RULE_ID_MAX = 10100;

// グローバル状態（Service Worker再起動時に再初期化される）
let globalConfig: NetworkMonitorConfig = DEFAULT_NETWORK_MONITOR_CONFIG;
let globalOwnExtensionId: string = "";
let globalKnownExtensions = new Map<string, ExtensionInfo>();
let globalCallbacks: ((request: NetworkRequestRecord) => void)[] = [];
let isListenerRegistered = false;
let isExtensionListInitialized = false;
let isDNRRulesRegistered = false;
let lastMatchedRulesCheck = 0;

// DNR API レート制限対策
const DNR_QUOTA_INTERVAL_MS = 10 * 60 * 1000;
const DNR_MAX_CALLS_PER_INTERVAL = 18;
const DNR_MIN_INTERVAL_MS = 35 * 1000;

let lastDNRCallTime = 0;
let dnrCallCount = 0;
let dnrQuotaWindowStart = 0;
let dnrRuleToExtensionMap = new Map<number, string>();

/**
 * グローバルコールバックをクリア
 */
export function clearGlobalCallbacks(): void {
  globalCallbacks = [];
}

/**
 * initiatorからタイプを判定
 */
function classifyInitiator(initiator: string | undefined): InitiatorType {
  if (!initiator) return "browser";
  if (initiator.startsWith("chrome-extension://")) return "extension";
  if (initiator.startsWith("http://") || initiator.startsWith("https://")) return "page";
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

/**
 * webRequestリスナーのハンドラー
 * 全ネットワークリクエストを処理
 */
function handleWebRequest(
  details: chrome.webRequest.WebRequestBodyDetails
): void {
  if (!globalConfig.enabled) return;

  const initiatorType = classifyInitiator(details.initiator);

  // 自身の拡張機能を除外
  if (globalConfig.excludeOwnExtension && initiatorType === "extension") {
    const extId = extractExtensionId(details.initiator!);
    if (extId === globalOwnExtensionId) return;
  }

  // 除外ドメインチェック
  const domain = extractDomain(details.url);
  if (globalConfig.excludedDomains.includes(domain)) return;

  // 拡張機能の場合の除外チェック
  let extensionId: string | undefined;
  let extensionName: string | undefined;

  if (initiatorType === "extension" && details.initiator) {
    extensionId = extractExtensionId(details.initiator) ?? undefined;
    if (extensionId && globalConfig.excludedExtensions.includes(extensionId)) {
      return;
    }
    const extInfo = globalKnownExtensions.get(extensionId || "");
    extensionName = extInfo?.name;
  }

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

  for (const cb of globalCallbacks) {
    try {
      cb(record);
    } catch (error) {
      logger.error("Callback error:", error);
    }
  }
}

/**
 * webRequestリスナーを同期的に登録
 */
export function registerNetworkMonitorListener(): void {
  if (isListenerRegistered) {
    logger.debug("Network monitor listener already registered");
    return;
  }

  try {
    chrome.webRequest.onBeforeRequest.addListener(
      handleWebRequest,
      { urls: ["<all_urls>"] }
    );
    isListenerRegistered = true;
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
      .filter((r) => r.id >= DNR_RULE_ID_BASE && r.id < DNR_RULE_ID_MAX)
      .map((r) => r.id);
    dnrRuleToExtensionMap.clear();

    const targetExtensions = extensionIds.slice(0, DNR_RULE_ID_MAX - DNR_RULE_ID_BASE);
    const newRules: chrome.declarativeNetRequest.Rule[] = targetExtensions
      .map((extId, index) => {
        const ruleId = DNR_RULE_ID_BASE + index;
        dnrRuleToExtensionMap.set(ruleId, extId);
        return {
          id: ruleId,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
          },
          condition: {
            initiatorDomains: [extId],
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER,
              chrome.declarativeNetRequest.ResourceType.SCRIPT,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.IMAGE,
            ],
          },
        };
      });

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: newRules,
    });

    isDNRRulesRegistered = true;
    logger.info(`DNR rules registered for ${newRules.length} extensions`);
  } catch (error) {
    logger.error("Failed to register DNR rules:", error);
  }
}

/**
 * DNRマッチルールをチェック
 */
export async function checkMatchedDNRRules(): Promise<NetworkRequestRecord[]> {
  if (!isDNRRulesRegistered || !globalConfig.enabled) {
    return [];
  }

  const now = Date.now();

  if (now - dnrQuotaWindowStart >= DNR_QUOTA_INTERVAL_MS) {
    dnrQuotaWindowStart = now;
    dnrCallCount = 0;
  }

  if (dnrCallCount >= DNR_MAX_CALLS_PER_INTERVAL) {
    return [];
  }

  if (now - lastDNRCallTime < DNR_MIN_INTERVAL_MS) {
    return [];
  }

  lastDNRCallTime = now;
  dnrCallCount++;

  try {
    const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({
      minTimeStamp: lastMatchedRulesCheck,
    });

    lastMatchedRulesCheck = now;
    const records: NetworkRequestRecord[] = [];

    for (const info of matchedRules.rulesMatchedInfo) {
      const ruleId = info.rule.ruleId;
      if (ruleId < DNR_RULE_ID_BASE || ruleId >= DNR_RULE_ID_MAX) {
        continue;
      }

      const extensionId = dnrRuleToExtensionMap.get(ruleId);
      if (!extensionId) continue;
      if (globalConfig.excludedExtensions.includes(extensionId)) continue;

      const extInfo = globalKnownExtensions.get(extensionId);

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

      for (const cb of globalCallbacks) {
        try {
          cb(record);
        } catch (error) {
          logger.error("Callback error:", error);
        }
      }
    }

    return records;
  } catch (error) {
    const errorMessage = String(error);
    if (errorMessage.includes("quota") || errorMessage.includes("QUOTA")) {
      logger.warn("DNR quota exceeded, entering backoff mode");
      dnrCallCount = DNR_MAX_CALLS_PER_INTERVAL;
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
      .filter((r) => r.id >= DNR_RULE_ID_BASE && r.id < DNR_RULE_ID_MAX)
      .map((r) => r.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    isDNRRulesRegistered = false;
    dnrRuleToExtensionMap.clear();
    logger.debug("DNR rules cleared");
  } catch (error) {
    logger.error("Failed to clear DNR rules:", error);
  }
}

/**
 * 単一の拡張機能のDNRルールを追加
 */
export async function addDNRRuleForExtension(extensionId: string): Promise<void> {
  if (!extensionId || !/^[a-z]{32}$/.test(extensionId)) {
    logger.warn(`Invalid extension ID format: ${extensionId}`);
    return;
  }

  try {
    const existingExtIds = Array.from(dnrRuleToExtensionMap.values());
    if (existingExtIds.includes(extensionId)) {
      return;
    }

    const usedRuleIds = new Set(dnrRuleToExtensionMap.keys());
    let ruleId: number | null = null;
    for (let i = DNR_RULE_ID_BASE; i < DNR_RULE_ID_MAX; i++) {
      if (!usedRuleIds.has(i)) {
        ruleId = i;
        break;
      }
    }

    if (ruleId === null) {
      logger.warn(`Cannot add DNR rule for ${extensionId}: no available rule ID`);
      return;
    }

    const newRule: chrome.declarativeNetRequest.Rule = {
      id: ruleId,
      priority: 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
      condition: {
        initiatorDomains: [extensionId],
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.OTHER,
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
          chrome.declarativeNetRequest.ResourceType.IMAGE,
        ],
      },
    };

    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [newRule] });
    dnrRuleToExtensionMap.set(ruleId, extensionId);
    logger.info(`DNR rule ${ruleId} added for extension ${extensionId}`);
  } catch (error) {
    logger.error(`Failed to add DNR rule for ${extensionId}:`, error);
  }
}

/**
 * 拡張機能のDNRルールを削除
 */
export async function removeDNRRuleForExtension(extensionId: string): Promise<void> {
  try {
    let ruleIdToRemove: number | null = null;
    for (const [ruleId, mappedExtId] of dnrRuleToExtensionMap.entries()) {
      if (mappedExtId === extensionId) {
        ruleIdToRemove = ruleId;
        break;
      }
    }

    if (ruleIdToRemove === null) return;

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleIdToRemove],
    });
    dnrRuleToExtensionMap.delete(ruleIdToRemove);
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
  globalConfig = config;
  globalOwnExtensionId = ownExtensionId;

  async function refreshExtensionList(): Promise<void> {
    try {
      const extensions = await chrome.management.getAll();
      globalKnownExtensions.clear();
      for (const ext of extensions) {
        if (ext.type === "extension") {
          globalKnownExtensions.set(ext.id, {
            id: ext.id,
            name: ext.name,
            version: ext.version,
            enabled: ext.enabled,
            icons: ext.icons,
          });
        }
      }
      isExtensionListInitialized = true;
      logger.debug(`Extension list refreshed: ${globalKnownExtensions.size} extensions`);
    } catch (error) {
      logger.warn("Failed to get extension list:", error);
    }
  }

  function handleInstalled(info: chrome.management.ExtensionInfo): void {
    if (info.type !== "extension") return;
    if (info.id === ownExtensionId) return;
    if (globalConfig.excludedExtensions.includes(info.id)) return;

    refreshExtensionList().catch(() => {});
    addDNRRuleForExtension(info.id).catch(() => {});
  }

  function handleUninstalled(extensionId: string): void {
    refreshExtensionList().catch(() => {});
    removeDNRRuleForExtension(extensionId).catch(() => {});
  }

  async function restoreDNRMapping(): Promise<void> {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const relevantRules = existingRules.filter(
        (r) => r.id >= DNR_RULE_ID_BASE && r.id < DNR_RULE_ID_MAX
      );

      dnrRuleToExtensionMap.clear();
      for (const rule of relevantRules) {
        if (rule.condition?.initiatorDomains?.length === 1) {
          const extensionId = rule.condition.initiatorDomains[0];
          if (/^[a-z]{32}$/.test(extensionId)) {
            dnrRuleToExtensionMap.set(rule.id, extensionId);
          }
        }
      }

      isDNRRulesRegistered = dnrRuleToExtensionMap.size > 0;
      logger.info(`DNR mapping restored: ${dnrRuleToExtensionMap.size} rules`);
    } catch (error) {
      logger.error("Failed to restore DNR mapping:", error);
    }
  }

  return {
    async start() {
      if (!globalConfig.enabled) {
        logger.debug("Network monitor disabled by config");
        return;
      }

      if (!isListenerRegistered) {
        registerNetworkMonitorListener();
      }

      await refreshExtensionList();
      logger.info(`Network monitor started: capturing ${globalConfig.captureAllRequests ? "all" : "extension"} requests`);

      let mappingRestored = false;
      if (!isDNRRulesRegistered && dnrRuleToExtensionMap.size === 0) {
        await restoreDNRMapping();
        mappingRestored = dnrRuleToExtensionMap.size > 0;
      }

      chrome.management.onInstalled.addListener(handleInstalled);
      chrome.management.onUninstalled.addListener(handleUninstalled);

      if (!mappingRestored) {
        const otherExtensionIds = Array.from(globalKnownExtensions.keys()).filter(
          (id) => id !== ownExtensionId && !globalConfig.excludedExtensions.includes(id)
        );
        await registerDNRRulesForExtensions(otherExtensionIds);
      }
    },

    async stop() {
      chrome.management.onInstalled.removeListener(handleInstalled);
      chrome.management.onUninstalled.removeListener(handleUninstalled);
      globalConfig = { ...globalConfig, enabled: false };
      clearGlobalCallbacks();
      await clearDNRRules();
    },

    getKnownExtensions: () => globalKnownExtensions,

    onRequest(callback) {
      globalCallbacks.push(callback);
    },

    refreshExtensionList,

    checkDNRMatches: checkMatchedDNRRules,

    generateStats(records) {
      // NetworkRequestRecord を ExtensionRequestRecord に変換（後方互換）
      const extRecords: ExtensionRequestRecord[] = records
        .filter(r => r.initiatorType === "extension" && r.extensionId)
        .map(r => ({
          id: r.id,
          extensionId: r.extensionId!,
          extensionName: r.extensionName || "Unknown",
          timestamp: r.timestamp,
          url: r.url,
          method: r.method,
          resourceType: r.resourceType,
          domain: r.domain,
          detectedBy: r.detectedBy,
        }));
      return globalExtensionStatsCache.getStats(extRecords);
    },

    detectSuspiciousPatterns(records) {
      const extRecords: ExtensionRequestRecord[] = records
        .filter(r => r.initiatorType === "extension" && r.extensionId)
        .map(r => ({
          id: r.id,
          extensionId: r.extensionId!,
          extensionName: r.extensionName || "Unknown",
          timestamp: r.timestamp,
          url: r.url,
          method: r.method,
          resourceType: r.resourceType,
          domain: r.domain,
          detectedBy: r.detectedBy,
        }));
      return detectAllSuspiciousPatterns(extRecords, DEFAULT_SUSPICIOUS_PATTERN_CONFIG);
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
