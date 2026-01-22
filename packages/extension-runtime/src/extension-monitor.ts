/**
 * Extension Network Monitor
 *
 * 他のChrome拡張機能が発するネットワークリクエストを監視する
 *
 * 監視方式:
 * 1. webRequest.onBeforeRequest - コンテンツスクリプト/ページからのリクエスト
 * 2. declarativeNetRequest - Service Workerからのリクエスト（Chrome 111+）
 *
 * MV3 Service Worker対応:
 * - webRequest.onBeforeRequestリスナーは同期的にトップレベルで登録する必要がある
 * - Service Workerの再起動時にリスナーが維持されるように設計
 */

import type {
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
} from "./storage-types.js";
import { createLogger } from "./logger.js";
import {
  generateDashboardStats,
  globalExtensionStatsCache,
  type DashboardStats,
} from "./extension-stats-analyzer.js";

const logger = createLogger("extension-monitor");

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
let globalConfig: ExtensionMonitorConfig = DEFAULT_EXTENSION_MONITOR_CONFIG;
let globalOwnExtensionId: string = "";
let globalKnownExtensions = new Map<string, ExtensionInfo>();
let globalCallbacks: ((request: ExtensionRequestRecord) => void)[] = [];
let isListenerRegistered = false;
let isExtensionListInitialized = false;
let isDNRRulesRegistered = false;
let lastMatchedRulesCheck = 0;
// ルールID→拡張機能IDの明示的マッピング（拡張機能追加/削除時の不整合を防ぐ）
let dnrRuleToExtensionMap = new Map<number, string>();

/**
 * グローバルコールバックをクリア
 * 設定変更時のメモリリーク防止のため
 */
export function clearGlobalCallbacks(): void {
  globalCallbacks = [];
}

function isExtensionRequest(
  details: chrome.webRequest.WebRequestDetails
): boolean {
  return details.initiator?.startsWith("chrome-extension://") ?? false;
}

function extractExtensionId(initiator: string): string | null {
  const match = initiator.match(/^chrome-extension:\/\/([a-z]{32})/);
  return match?.[1] ?? null;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * webRequestリスナーのハンドラー
 * グローバル状態を参照して動作する
 */
function handleWebRequest(
  details: chrome.webRequest.WebRequestBodyDetails
): void {
  // 設定が無効な場合は何もしない
  if (!globalConfig.enabled) return;

  if (!isExtensionRequest(details)) return;

  const extensionId = extractExtensionId(details.initiator!);
  if (!extensionId) return;

  // 自分自身を除外
  if (globalConfig.excludeOwnExtension && extensionId === globalOwnExtensionId) {
    return;
  }

  // 除外リストチェック
  if (globalConfig.excludedExtensions.includes(extensionId)) return;

  const extInfo = globalKnownExtensions.get(extensionId);
  const extensionName = extInfo?.name || "Unknown Extension";

  // 拡張機能リストが初期化されていない場合は警告
  if (!isExtensionListInitialized && !extInfo) {
    logger.debug("Extension request before list initialized:", extensionId);
  }

  const record: ExtensionRequestRecord = {
    id: crypto.randomUUID(),
    extensionId,
    extensionName,
    timestamp: Date.now(),
    url: details.url,
    method: details.method,
    resourceType: details.type,
    domain: extractDomain(details.url),
    detectedBy: "webRequest",
  };

  logger.debug("Extension request detected:", {
    extensionId,
    extensionName,
    url: record.url.substring(0, 100),
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
 * MV3 Service Workerではトップレベルで同期的に呼び出す必要がある
 */
export function registerExtensionMonitorListener(): void {
  if (isListenerRegistered) {
    logger.debug("Extension monitor listener already registered");
    return;
  }

  try {
    chrome.webRequest.onBeforeRequest.addListener(
      handleWebRequest,
      { urls: ["<all_urls>"] }
    );
    isListenerRegistered = true;
    logger.info("webRequest.onBeforeRequest listener registered");
  } catch (error) {
    logger.error("Failed to register webRequest listener:", error);
  }
}

/**
 * declarativeNetRequestルールを登録
 * 他の拡張機能からのリクエストを検出するため
 *
 * 注意: DNRのinitiatorDomainsは通常のドメイン名を期待するため、
 * 拡張機能IDを指定してもマッチしない可能性があります。
 * 現在は全リクエストをALLOWルールでマッチさせ、tabId=-1（Service Worker）を検出する方式です。
 *
 * 制限事項:
 * - 最大100個の拡張機能を監視可能（DNR_RULE_ID_BASE〜DNR_RULE_ID_MAX）
 * - DNR検出時はリクエストURLの詳細が取得できない
 */
export async function registerDNRRulesForExtensions(
  extensionIds: string[]
): Promise<void> {
  if (extensionIds.length === 0) {
    logger.debug("No extensions to monitor with DNR");
    return;
  }

  try {
    // 既存のルールとマッピングをクリア
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((r) => r.id >= DNR_RULE_ID_BASE && r.id < DNR_RULE_ID_MAX)
      .map((r) => r.id);
    dnrRuleToExtensionMap.clear();

    // 各拡張機能に対してルールを作成（最大100個）
    const targetExtensions = extensionIds.slice(0, DNR_RULE_ID_MAX - DNR_RULE_ID_BASE);
    const newRules: chrome.declarativeNetRequest.Rule[] = targetExtensions
      .map((extId, index) => {
        const ruleId = DNR_RULE_ID_BASE + index;
        // ルールID→拡張機能IDのマッピングを設定
        dnrRuleToExtensionMap.set(ruleId, extId);
        return {
          id: ruleId,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
          },
          condition: {
            // 拡張機能からのリクエストを対象（initiatorDomainsにextIdを指定）
            // 注: Chrome拡張機能のinitiatorは chrome-extension://[id] 形式
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
    logger.info(
      `DNR rules registered for ${newRules.length} extensions (mapping: ${dnrRuleToExtensionMap.size})`
    );
  } catch (error) {
    logger.error("Failed to register DNR rules:", error);
  }
}

/**
 * declarativeNetRequestのマッチしたルールを取得して処理
 * Service Workerからのリクエストを検出
 */
export async function checkMatchedDNRRules(): Promise<ExtensionRequestRecord[]> {
  if (!isDNRRulesRegistered || !globalConfig.enabled) {
    return [];
  }

  try {
    const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({
      minTimeStamp: lastMatchedRulesCheck,
    });

    lastMatchedRulesCheck = Date.now();

    const records: ExtensionRequestRecord[] = [];

    for (const info of matchedRules.rulesMatchedInfo) {
      const ruleId = info.rule.ruleId;
      if (ruleId < DNR_RULE_ID_BASE || ruleId >= DNR_RULE_ID_MAX) {
        continue;
      }

      // ルールID→拡張機能IDのマッピングから取得（順序に依存しない）
      const extensionId = dnrRuleToExtensionMap.get(ruleId);

      if (!extensionId) {
        logger.debug(`No extension mapping for rule ${ruleId}`);
        continue;
      }

      // 除外チェック
      if (globalConfig.excludedExtensions.includes(extensionId)) continue;

      const extInfo = globalKnownExtensions.get(extensionId);
      const extensionName = extInfo?.name || "Unknown Extension";

      const record: ExtensionRequestRecord = {
        id: crypto.randomUUID(),
        extensionId,
        extensionName,
        timestamp: info.timeStamp,
        url: `[DNR detected - tabId: ${info.tabId}]`,
        method: "UNKNOWN",
        resourceType: "xmlhttprequest",
        domain: "unknown",
        detectedBy: "declarativeNetRequest",
      };

      records.push(record);

      logger.debug("Extension request detected via DNR:", {
        extensionId,
        extensionName,
        tabId: info.tabId,
      });

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

export interface ExtensionMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getKnownExtensions(): Map<string, ExtensionInfo>;
  onRequest(callback: (request: ExtensionRequestRecord) => void): void;
  refreshExtensionList(): Promise<void>;
  /** DNRマッチルールをチェック（定期的に呼び出す） */
  checkDNRMatches(): Promise<ExtensionRequestRecord[]>;
  /** ダッシュボード統計を生成 */
  generateStats(records: ExtensionRequestRecord[]): DashboardStats;
}

/**
 * Extension Monitorを作成
 * 注意: webRequestリスナーはregisterExtensionMonitorListener()で事前に登録済みである必要がある
 */
export function createExtensionMonitor(
  config: ExtensionMonitorConfig,
  ownExtensionId: string
): ExtensionMonitor {
  // グローバル状態を更新
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

  function handleInstalled(): void {
    refreshExtensionList().catch((err) =>
      logger.debug("Refresh on install failed:", err)
    );
  }

  function handleUninstalled(): void {
    refreshExtensionList().catch((err) =>
      logger.debug("Refresh on uninstall failed:", err)
    );
  }

  return {
    async start() {
      if (!globalConfig.enabled) {
        logger.debug("Extension monitor disabled by config");
        return;
      }

      // リスナーがまだ登録されていない場合は登録（フォールバック）
      if (!isListenerRegistered) {
        registerExtensionMonitorListener();
      }

      await refreshExtensionList();
      logger.info(`Extension monitor started: ${globalKnownExtensions.size} extensions found`);

      // 拡張機能の追加/削除を監視
      chrome.management.onInstalled.addListener(handleInstalled);
      chrome.management.onUninstalled.addListener(handleUninstalled);

      // DNRルールを登録（自分以外の拡張機能を監視）
      const otherExtensionIds = Array.from(globalKnownExtensions.keys()).filter(
        (id) => id !== ownExtensionId && !globalConfig.excludedExtensions.includes(id)
      );
      await registerDNRRulesForExtensions(otherExtensionIds);
    },

    async stop() {
      chrome.management.onInstalled.removeListener(handleInstalled);
      chrome.management.onUninstalled.removeListener(handleUninstalled);
      // webRequestリスナーは維持（Service Workerのライフサイクル対応）
      globalConfig = { ...globalConfig, enabled: false };
      // コールバックをクリア（メモリリーク防止）
      clearGlobalCallbacks();
      // DNRルールをクリア
      await clearDNRRules();
    },

    getKnownExtensions() {
      return globalKnownExtensions;
    },

    onRequest(callback) {
      globalCallbacks.push(callback);
    },

    refreshExtensionList,

    async checkDNRMatches() {
      return checkMatchedDNRRules();
    },

    generateStats(records) {
      return globalExtensionStatsCache.getStats(records);
    },
  };
}
