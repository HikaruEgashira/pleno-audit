/**
 * 型安全なストレージアクセス層
 */
import type {
  StorageData,
  CSPConfig,
  CSPReport,
  DetectedService,
  EventLog,
  CapturedAIPrompt,
  AIMonitorConfig,
  DataRetentionConfig,
  DetectionConfig,
  BlockingConfig,
} from "./storage-types.js";
import {
  DEFAULT_DATA_RETENTION_CONFIG,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_BLOCKING_CONFIG,
} from "./storage-types.js";
import type { NRDConfig } from "@pleno-audit/detectors";
import { DEFAULT_NRD_CONFIG } from "@pleno-audit/detectors";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import { DEFAULT_AI_MONITOR_CONFIG } from "@pleno-audit/detectors";
import { getBrowserAPI } from "./browser-adapter.js";

const STORAGE_KEYS = [
  "services",
  "events",
  "cspReports",
  "cspConfig",
  "aiPrompts",
  "aiMonitorConfig",
  "nrdConfig",
  "dataRetentionConfig",
  "detectionConfig",
  "blockingConfig",
] as const;
type StorageKey = (typeof STORAGE_KEYS)[number];

let storageQueue: Promise<void> = Promise.resolve();

export function queueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    storageQueue = storageQueue
      .then(() => operation())
      .then(resolve)
      .catch(reject);
  });
}

export async function getStorage(): Promise<StorageData> {
  const api = getBrowserAPI();
  const result = await api.storage.local.get(STORAGE_KEYS as unknown as string[]);
  return {
    services: (result.services as Record<string, DetectedService>) || {},
    events: (result.events as EventLog[]) || [],
    cspReports: (result.cspReports as CSPReport[]) || [],
    cspConfig: (result.cspConfig as CSPConfig) || DEFAULT_CSP_CONFIG,
    aiPrompts: (result.aiPrompts as CapturedAIPrompt[]) || [],
    aiMonitorConfig:
      (result.aiMonitorConfig as AIMonitorConfig) || DEFAULT_AI_MONITOR_CONFIG,
    nrdConfig: (result.nrdConfig as NRDConfig) || DEFAULT_NRD_CONFIG,
    dataRetentionConfig:
      (result.dataRetentionConfig as DataRetentionConfig) || DEFAULT_DATA_RETENTION_CONFIG,
    detectionConfig:
      (result.detectionConfig as DetectionConfig) || DEFAULT_DETECTION_CONFIG,
    blockingConfig:
      (result.blockingConfig as BlockingConfig) || DEFAULT_BLOCKING_CONFIG,
  };
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  const api = getBrowserAPI();
  await api.storage.local.set(data);
}

export async function getStorageKey<K extends StorageKey>(
  key: K
): Promise<StorageData[K]> {
  const api = getBrowserAPI();
  const result = await api.storage.local.get([key]);
  const defaults: StorageData = {
    services: {},
    events: [],
    cspReports: [],
    cspConfig: DEFAULT_CSP_CONFIG,
    aiPrompts: [],
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
    nrdConfig: DEFAULT_NRD_CONFIG,
    dataRetentionConfig: DEFAULT_DATA_RETENTION_CONFIG,
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    blockingConfig: DEFAULT_BLOCKING_CONFIG,
  };
  return (result[key] as StorageData[K]) ?? defaults[key];
}

export async function getServiceCount(): Promise<number> {
  const services = await getStorageKey("services");
  return Object.keys(services).length;
}

export async function clearCSPReports(): Promise<void> {
  const api = getBrowserAPI();
  await api.storage.local.remove(["cspReports"]);
}

/**
 * AIプロンプトをクリア
 */
export async function clearAIPrompts(): Promise<void> {
  const api = getBrowserAPI();
  await api.storage.local.remove(["aiPrompts"]);
}

/**
 * 全ストレージをクリアし、設定をデフォルトに戻す
 * @param options.preserveTheme - trueの場合テーマ設定を維持
 */
export async function clearAllStorage(options?: { preserveTheme?: boolean }): Promise<void> {
  const api = getBrowserAPI();

  // テーマ設定を保存（オプション）
  let savedTheme: string | undefined;
  if (options?.preserveTheme) {
    const result = await api.storage.local.get(["themeMode"]);
    savedTheme = result.themeMode as string | undefined;
  }

  // 全ストレージをクリア
  await api.storage.local.clear();

  // デフォルト設定を復元
  const defaultSettings: Partial<StorageData> = {
    services: {},
    events: [],
    cspReports: [],
    cspConfig: DEFAULT_CSP_CONFIG,
    aiPrompts: [],
    aiMonitorConfig: DEFAULT_AI_MONITOR_CONFIG,
    nrdConfig: DEFAULT_NRD_CONFIG,
    dataRetentionConfig: DEFAULT_DATA_RETENTION_CONFIG,
    detectionConfig: DEFAULT_DETECTION_CONFIG,
    blockingConfig: DEFAULT_BLOCKING_CONFIG,
  };

  await api.storage.local.set(defaultSettings);

  // テーマ設定を復元（オプション）
  if (options?.preserveTheme && savedTheme) {
    await api.storage.local.set({ themeMode: savedTheme });
  }
}
