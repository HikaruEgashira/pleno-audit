/**
 * Extension Network Monitor
 *
 * 他のChrome拡張機能が発するネットワークリクエストを監視する
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

export interface ExtensionMonitor {
  start(): void;
  stop(): void;
  getKnownExtensions(): Map<string, ExtensionInfo>;
  onRequest(callback: (request: ExtensionRequestRecord) => void): void;
  refreshExtensionList(): Promise<void>;
}

export function createExtensionMonitor(
  config: ExtensionMonitorConfig,
  ownExtensionId: string
): ExtensionMonitor {
  const knownExtensions = new Map<string, ExtensionInfo>();
  const callbacks: ((request: ExtensionRequestRecord) => void)[] = [];
  let isRunning = false;

  async function refreshExtensionList(): Promise<void> {
    try {
      const extensions = await chrome.management.getAll();
      knownExtensions.clear();
      for (const ext of extensions) {
        if (ext.type === "extension") {
          knownExtensions.set(ext.id, {
            id: ext.id,
            name: ext.name,
            version: ext.version,
            enabled: ext.enabled,
            icons: ext.icons,
          });
        }
      }
    } catch (error) {
      logger.warn("Failed to get extension list:", error);
    }
  }

  function handleRequest(
    details: chrome.webRequest.WebRequestBodyDetails
  ): void {
    if (!isExtensionRequest(details)) return;

    const extensionId = extractExtensionId(details.initiator!);
    if (!extensionId) return;

    // 自分自身を除外
    if (config.excludeOwnExtension && extensionId === ownExtensionId) return;

    // 除外リストチェック
    if (config.excludedExtensions.includes(extensionId)) return;

    const extInfo = knownExtensions.get(extensionId);

    const record: ExtensionRequestRecord = {
      id: crypto.randomUUID(),
      extensionId,
      extensionName: extInfo?.name || "Unknown Extension",
      timestamp: Date.now(),
      url: details.url,
      method: details.method,
      resourceType: details.type,
      domain: extractDomain(details.url),
    };

    for (const cb of callbacks) {
      try {
        cb(record);
      } catch (error) {
        logger.error("Callback error:", error);
      }
    }
  }

  function handleInstalled(): void {
    refreshExtensionList().catch((err) => logger.debug("Refresh on install failed:", err));
  }

  function handleUninstalled(): void {
    refreshExtensionList().catch((err) => logger.debug("Refresh on uninstall failed:", err));
  }

  return {
    async start() {
      if (isRunning) return;
      isRunning = true;

      await refreshExtensionList();

      // 拡張機能の追加/削除を監視
      chrome.management.onInstalled.addListener(handleInstalled);
      chrome.management.onUninstalled.addListener(handleUninstalled);

      // リクエスト監視開始
      chrome.webRequest.onBeforeRequest.addListener(
        handleRequest,
        { urls: ["<all_urls>"] },
        ["requestBody"]
      );
    },

    stop() {
      if (!isRunning) return;
      isRunning = false;

      chrome.management.onInstalled.removeListener(handleInstalled);
      chrome.management.onUninstalled.removeListener(handleUninstalled);
      chrome.webRequest.onBeforeRequest.removeListener(handleRequest);
    },

    getKnownExtensions() {
      return knownExtensions;
    },

    onRequest(callback) {
      callbacks.push(callback);
    },

    refreshExtensionList,
  };
}
