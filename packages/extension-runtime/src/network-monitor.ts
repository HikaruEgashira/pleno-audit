/**
 * Network Monitor
 *
 * 後方互換性のための re-export モジュール
 * 実装は network-monitor/ ディレクトリに分割されています
 */

// 全ての公開APIを re-export
export {
  // Types
  type ExtensionInfo,
  type NetworkMonitor,
  type ExtensionMonitor,
  // Constants
  DEFAULT_EXTENSION_MONITOR_CONFIG,
  // State
  clearGlobalCallbacks,
  // Web Request
  registerNetworkMonitorListener,
  registerExtensionMonitorListener,
  // DNR Manager
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
  // Factory
  createNetworkMonitor,
  createExtensionMonitor,
} from "./network-monitor/index.js";
