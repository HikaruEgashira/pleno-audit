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
  ExtensionMonitorConfig,
} from "../storage-types.js";
import { createLogger } from "../logger.js";
import {
  globalExtensionStatsCache,
} from "../extension-stats-analyzer.js";
import {
  detectAllSuspiciousPatterns,
  DEFAULT_SUSPICIOUS_PATTERN_CONFIG,
} from "../suspicious-pattern-detector.js";

// Internal modules
import { state, applyConfig, clearGlobalCallbacks } from "./state.js";
import { DEFAULT_EXTENSION_MONITOR_CONFIG, EXTENSION_ID_PATTERN } from "./constants.js";
import {
  registerNetworkMonitorListener,
  registerExtensionMonitorListener,
} from "./web-request.js";
import {
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
  restoreDNRMapping,
} from "./dnr-manager.js";
import { refreshExtensionList, getKnownExtensions } from "./extension-tracker.js";
import { toExtensionRequestRecords } from "./utils.js";

// Re-exports for public API
export { clearGlobalCallbacks } from "./state.js";
export { DEFAULT_EXTENSION_MONITOR_CONFIG } from "./constants.js";
export {
  registerNetworkMonitorListener,
  registerExtensionMonitorListener,
} from "./web-request.js";
export {
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
} from "./dnr-manager.js";

// Re-export types
export type { ExtensionInfo, NetworkMonitor, ExtensionMonitor } from "./types.js";

const logger = createLogger("network-monitor");

/**
 * Network Monitorを作成
 */
export function createNetworkMonitor(
  config: NetworkMonitorConfig,
  ownExtensionId: string
): import("./types.js").NetworkMonitor {
  applyConfig(config);
  state.ownExtensionId = ownExtensionId;

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
        const otherExtensionIds = Array.from(getKnownExtensions().keys()).filter(
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

    getKnownExtensions,

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

/**
 * 後方互換性: 旧関数名のエイリアス
 */
export function createExtensionMonitor(
  config: ExtensionMonitorConfig,
  ownExtensionId: string
): import("./types.js").NetworkMonitor {
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
