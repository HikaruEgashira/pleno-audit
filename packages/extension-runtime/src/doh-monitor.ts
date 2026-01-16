/**
 * DoH (DNS over HTTPS) Monitor
 *
 * RFC 8484準拠のプロトコル特性に基づいてDoHトラフィックを検出する
 * 特定のサービスリストを持たず、汎用的に検出
 */

import { createLogger } from "./logger.js";

const logger = createLogger("doh-monitor");

export interface DoHMonitorConfig {
  enabled: boolean;
  blockEnabled: boolean;
  maxStoredRequests: number;
}

export const DEFAULT_DOH_MONITOR_CONFIG: DoHMonitorConfig = {
  enabled: true,
  blockEnabled: false, // デフォルトオフ
  maxStoredRequests: 1000,
};

export interface DoHRequestRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  method: string;
  detectionMethod: DoHDetectionMethod;
  initiator?: string;
  blocked: boolean;
}

export type DoHDetectionMethod =
  | "content-type"
  | "accept-header"
  | "url-path"
  | "dns-param";

/**
 * DoHリクエストを検出するためのURLパターン
 * 全URLではなく、DoHの可能性があるURLのみをフィルタリング
 */
export const DOH_URL_PATTERNS = [
  "*://*/dns-query",
  "*://*/dns-query?*",
  "*://*/*?dns=*",
];

// グローバル状態
let globalConfig: DoHMonitorConfig = DEFAULT_DOH_MONITOR_CONFIG;
let globalCallbacks: ((request: DoHRequestRecord) => void)[] = [];
let isListenerRegistered = false;
let isBlockingRuleRegistered = false;

// declarativeNetRequest用のルールID
const DOH_BLOCK_RULE_ID = 9999;

/**
 * グローバルコールバックをクリア
 */
export function clearDoHCallbacks(): void {
  globalCallbacks = [];
}

/**
 * URLからドメインを抽出
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * DoHリクエストかどうかを判定（RFC 8484準拠）
 * 特定サービスのリストを持たず、プロトコル特性で検出
 */
export function detectDoHRequest(
  url: string,
  headers?: { name: string; value?: string }[]
): { isDoH: boolean; method: DoHDetectionMethod | null } {
  // 1. Content-Type検出（POST DoH）- charset等の付加情報に対応
  const contentType = headers?.find(
    (h) => h.name.toLowerCase() === "content-type"
  )?.value;
  if (contentType?.startsWith("application/dns-message")) {
    return { isDoH: true, method: "content-type" };
  }

  // 2. Accept検出
  const accept = headers?.find(
    (h) => h.name.toLowerCase() === "accept"
  )?.value;
  if (accept?.includes("application/dns-message")) {
    return { isDoH: true, method: "accept-header" };
  }

  try {
    const parsedUrl = new URL(url);

    // 3. URLパスパターン（汎用）
    if (parsedUrl.pathname.endsWith("/dns-query")) {
      return { isDoH: true, method: "url-path" };
    }

    // 4. dns= クエリパラメータ（GET DoH）
    if (parsedUrl.searchParams.has("dns")) {
      return { isDoH: true, method: "dns-param" };
    }
  } catch {
    // URL解析エラーは無視（無効なURLは非DoHとして扱う）
  }

  return { isDoH: false, method: null };
}

/**
 * DoHブロッキングルールを有効化
 */
async function enableDoHBlocking(): Promise<void> {
  if (isBlockingRuleRegistered) return;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id: DOH_BLOCK_RULE_ID,
          priority: 1,
          action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
          condition: {
            urlFilter: "*/dns-query*",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER,
            ],
          },
        },
      ],
      removeRuleIds: [DOH_BLOCK_RULE_ID],
    });
    isBlockingRuleRegistered = true;
    logger.info("DoH blocking rule enabled");
  } catch (error) {
    logger.error("Failed to enable DoH blocking:", error);
  }
}

/**
 * DoHブロッキングルールを無効化
 */
async function disableDoHBlocking(): Promise<void> {
  if (!isBlockingRuleRegistered) return;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DOH_BLOCK_RULE_ID],
    });
    isBlockingRuleRegistered = false;
    logger.info("DoH blocking rule disabled");
  } catch (error) {
    logger.error("Failed to disable DoH blocking:", error);
  }
}

/**
 * webRequestヘッダーリスナーのハンドラー
 */
function handleBeforeSendHeaders(
  details: chrome.webRequest.WebRequestHeadersDetails
): void {
  if (!globalConfig.enabled) return;

  const { isDoH, method } = detectDoHRequest(details.url, details.requestHeaders);

  if (!isDoH || !method) return;

  const record: DoHRequestRecord = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    url: details.url,
    domain: extractDomain(details.url),
    method: details.method,
    detectionMethod: method,
    initiator: details.initiator,
    blocked: globalConfig.blockEnabled,
  };

  logger.debug("DoH request detected:", {
    url: record.url.substring(0, 100),
    method: record.detectionMethod,
    domain: record.domain,
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
 * webRequestリスナーを登録
 * MV3 Service Workerではトップレベルで同期的に呼び出す必要がある
 */
export function registerDoHMonitorListener(): void {
  if (isListenerRegistered) {
    logger.debug("DoH monitor listener already registered");
    return;
  }

  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      handleBeforeSendHeaders,
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    );
    isListenerRegistered = true;
    logger.info("DoH monitor listener registered");
  } catch (error) {
    logger.error("Failed to register DoH monitor listener:", error);
  }
}

export interface DoHMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  onRequest(callback: (request: DoHRequestRecord) => void): void;
  updateConfig(config: Partial<DoHMonitorConfig>): Promise<void>;
  getConfig(): DoHMonitorConfig;
}

/**
 * DoH Monitorを作成
 */
export function createDoHMonitor(config: DoHMonitorConfig): DoHMonitor {
  globalConfig = { ...config };

  return {
    async start() {
      if (!globalConfig.enabled) {
        logger.debug("DoH monitor disabled by config");
        return;
      }

      if (!isListenerRegistered) {
        registerDoHMonitorListener();
      }

      // ブロックが有効なら declarativeNetRequest ルールを追加
      if (globalConfig.blockEnabled) {
        await enableDoHBlocking();
      }

      logger.info("DoH monitor started");
    },

    async stop() {
      globalConfig = { ...globalConfig, enabled: false };
      clearDoHCallbacks();
      await disableDoHBlocking();
      logger.info("DoH monitor stopped");
    },

    onRequest(callback) {
      globalCallbacks.push(callback);
    },

    async updateConfig(newConfig) {
      const prevBlockEnabled = globalConfig.blockEnabled;
      globalConfig = { ...globalConfig, ...newConfig };

      // ブロック設定が変更された場合、declarativeNetRequest ルールを更新
      if (newConfig.blockEnabled !== undefined && newConfig.blockEnabled !== prevBlockEnabled) {
        if (newConfig.blockEnabled) {
          await enableDoHBlocking();
        } else {
          await disableDoHBlocking();
        }
      }

      logger.debug("DoH monitor config updated:", globalConfig);
    },

    getConfig() {
      return { ...globalConfig };
    },
  };
}
