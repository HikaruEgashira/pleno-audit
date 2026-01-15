/**
 * Extension Network Monitor
 *
 * 他のChrome拡張機能が発するネットワークリクエストを監視する
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

// グローバル状態（Service Worker再起動時に再初期化される）
let globalConfig: ExtensionMonitorConfig = DEFAULT_EXTENSION_MONITOR_CONFIG;
let globalOwnExtensionId: string = "";
let globalKnownExtensions = new Map<string, ExtensionInfo>();
let globalCallbacks: ((request: ExtensionRequestRecord) => void)[] = [];
let isListenerRegistered = false;
let isExtensionListInitialized = false;

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

export interface ExtensionMonitor {
  start(): Promise<void>;
  stop(): void;
  getKnownExtensions(): Map<string, ExtensionInfo>;
  onRequest(callback: (request: ExtensionRequestRecord) => void): void;
  refreshExtensionList(): Promise<void>;
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
    },

    stop() {
      chrome.management.onInstalled.removeListener(handleInstalled);
      chrome.management.onUninstalled.removeListener(handleUninstalled);
      // webRequestリスナーは維持（Service Workerのライフサイクル対応）
      globalConfig = { ...globalConfig, enabled: false };
      // コールバックをクリア（メモリリーク防止）
      clearGlobalCallbacks();
    },

    getKnownExtensions() {
      return globalKnownExtensions;
    },

    onRequest(callback) {
      globalCallbacks.push(callback);
    },

    refreshExtensionList,
  };
}
