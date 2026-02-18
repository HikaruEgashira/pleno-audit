/**
 * Network Monitor
 *
 * 実装は network-monitor/ ディレクトリに分割されています
 */

// 全ての公開APIを re-export
export {
  // Types
  type ExtensionInfo,
  type NetworkMonitor,
  // State
  clearGlobalCallbacks,
  // Web Request
  registerNetworkMonitorListener,
  // DNR Manager
  registerDNRRulesForExtensions,
  checkMatchedDNRRules,
  clearDNRRules,
  addDNRRuleForExtension,
  removeDNRRuleForExtension,
  // Factory
  createNetworkMonitor,
} from "./network-monitor/index.js";
