/**
 * Network Monitor - Type Definitions
 *
 * ネットワーク監視に関する型定義
 */

import type {
  NetworkMonitorConfig,
  NetworkRequestRecord,
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
} from "../storage-types.js";
import type { DashboardStats } from "../extension-stats-analyzer.js";
import type { SuspiciousPattern } from "../suspicious-pattern-detector.js";

// Re-export for convenience
export type {
  NetworkMonitorConfig,
  NetworkRequestRecord,
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
};

/**
 * 拡張機能情報
 */
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons?: { size: number; url: string }[];
}

/**
 * Network Monitor 内部状態
 */
export interface NetworkMonitorState {
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

/**
 * Network Monitor インターフェース
 */
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
