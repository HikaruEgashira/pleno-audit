/**
 * 型安全なストレージアクセス層
 */
import type {
  StorageData,
  CSPConfig,
  CSPReport,
  DetectedService,
  EventLog,
} from "./storage-types";
import { DEFAULT_CSP_CONFIG } from "@service-policy-auditor/csp";

// ストレージキーの定義（型安全）
const STORAGE_KEYS = ["services", "events", "cspReports", "cspConfig"] as const;
type StorageKey = (typeof STORAGE_KEYS)[number];

// 操作をシリアライズするキュー
let storageQueue: Promise<void> = Promise.resolve();

/**
 * ストレージ操作をキューイング（競合防止）
 */
export function queueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    storageQueue = storageQueue
      .then(() => operation())
      .then(resolve)
      .catch(reject);
  });
}

/**
 * ストレージからデータを取得
 */
export async function getStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(STORAGE_KEYS as unknown as string[]);
  return {
    services: (result.services as Record<string, DetectedService>) || {},
    events: (result.events as EventLog[]) || [],
    cspReports: (result.cspReports as CSPReport[]) || [],
    cspConfig: (result.cspConfig as CSPConfig) || DEFAULT_CSP_CONFIG,
  };
}

/**
 * ストレージにデータを保存
 */
export async function setStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

/**
 * 特定のキーのみ取得（部分取得）
 */
export async function getStorageKey<K extends StorageKey>(
  key: K
): Promise<StorageData[K]> {
  const result = await chrome.storage.local.get([key]);
  const defaults: StorageData = {
    services: {},
    events: [],
    cspReports: [],
    cspConfig: DEFAULT_CSP_CONFIG,
  };
  return (result[key] as StorageData[K]) ?? defaults[key];
}

/**
 * サービス数を取得（バッジ更新用）
 */
export async function getServiceCount(): Promise<number> {
  const services = await getStorageKey("services");
  return Object.keys(services).length;
}

/**
 * CSPレポートをクリア
 */
export async function clearCSPReports(): Promise<void> {
  await chrome.storage.local.remove(["cspReports"]);
}
