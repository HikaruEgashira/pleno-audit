/**
 * Extension Monitor compatibility facade.
 *
 * Legacy deep-import consumers (`./extension-monitor`) continue to receive the
 * historical API surface while delegating runtime behavior to network-monitor.
 */

import {
  addDNRRuleForExtension,
  checkMatchedDNRRules as checkMatchedNetworkDNRRules,
  clearDNRRules,
  clearGlobalCallbacks,
  createExtensionMonitor as createNetworkExtensionMonitor,
  DEFAULT_EXTENSION_MONITOR_CONFIG as NETWORK_DEFAULT_EXTENSION_MONITOR_CONFIG,
  registerDNRRulesForExtensions,
  registerExtensionMonitorListener,
  removeDNRRuleForExtension,
  type ExtensionInfo,
  type NetworkMonitor,
} from "./network-monitor.js";
import type {
  ExtensionMonitorConfig,
  ExtensionRequestRecord,
  NetworkRequestRecord,
} from "./storage-types.js";

export const DEFAULT_EXTENSION_MONITOR_CONFIG: ExtensionMonitorConfig =
  NETWORK_DEFAULT_EXTENSION_MONITOR_CONFIG;

function toLegacyRecord(
  record: NetworkRequestRecord
): ExtensionRequestRecord | null {
  if (record.initiatorType !== "extension" || !record.extensionId) {
    return null;
  }

  return {
    id: record.id,
    extensionId: record.extensionId,
    extensionName: record.extensionName || "Unknown Extension",
    timestamp: record.timestamp,
    url: record.url,
    method: record.method,
    resourceType: record.resourceType,
    domain: record.domain,
    detectedBy: record.detectedBy,
  };
}

function toLegacyRecords(
  records: NetworkRequestRecord[]
): ExtensionRequestRecord[] {
  const legacyRecords: ExtensionRequestRecord[] = [];
  for (const record of records) {
    const legacyRecord = toLegacyRecord(record);
    if (legacyRecord) {
      legacyRecords.push(legacyRecord);
    }
  }
  return legacyRecords;
}

function toNetworkRecord(record: ExtensionRequestRecord): NetworkRequestRecord {
  return {
    id: record.id,
    timestamp: record.timestamp,
    url: record.url,
    method: record.method,
    domain: record.domain,
    resourceType: record.resourceType,
    initiator: `chrome-extension://${record.extensionId}`,
    initiatorType: "extension",
    extensionId: record.extensionId,
    extensionName: record.extensionName,
    tabId: -1,
    frameId: 0,
    detectedBy: record.detectedBy || "webRequest",
  };
}

export async function checkMatchedDNRRules(): Promise<ExtensionRequestRecord[]> {
  const records = await checkMatchedNetworkDNRRules();
  return toLegacyRecords(records);
}

export interface ExtensionMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getKnownExtensions(): Map<string, ExtensionInfo>;
  onRequest(callback: (request: ExtensionRequestRecord) => void): void;
  refreshExtensionList(): Promise<void>;
  checkDNRMatches(): Promise<ExtensionRequestRecord[]>;
  generateStats(
    records: ExtensionRequestRecord[]
  ): ReturnType<NetworkMonitor["generateStats"]>;
  detectSuspiciousPatterns(
    records: ExtensionRequestRecord[]
  ): ReturnType<NetworkMonitor["detectSuspiciousPatterns"]>;
}

export function createExtensionMonitor(
  config: ExtensionMonitorConfig,
  ownExtensionId: string
): ExtensionMonitor {
  const monitor = createNetworkExtensionMonitor(config, ownExtensionId);

  return {
    start: () => monitor.start(),
    stop: () => monitor.stop(),
    getKnownExtensions: () => monitor.getKnownExtensions(),
    onRequest(callback) {
      monitor.onRequest((record) => {
        const legacyRecord = toLegacyRecord(record);
        if (legacyRecord) {
          callback(legacyRecord);
        }
      });
    },
    refreshExtensionList: () => monitor.refreshExtensionList(),
    async checkDNRMatches() {
      const records = await monitor.checkDNRMatches();
      return toLegacyRecords(records);
    },
    generateStats(records) {
      const networkRecords = records.map(toNetworkRecord);
      return monitor.generateStats(networkRecords);
    },
    detectSuspiciousPatterns(records) {
      const networkRecords = records.map(toNetworkRecord);
      return monitor.detectSuspiciousPatterns(networkRecords);
    },
  };
}

export {
  addDNRRuleForExtension,
  clearDNRRules,
  clearGlobalCallbacks,
  registerDNRRulesForExtensions,
  registerExtensionMonitorListener,
  removeDNRRuleForExtension,
};
export type { ExtensionInfo };
