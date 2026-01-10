/**
 * 型安全なストレージアクセス層
 */
import type {
  StorageData,
  CSPConfig,
  CSPReport,
  DetectedService,
  EventLog,
} from "./storage-types.js";
import { DEFAULT_CSP_CONFIG } from "@service-policy-auditor/csp";

const STORAGE_KEYS = ["services", "events", "cspReports", "cspConfig"] as const;
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
  const result = await chrome.storage.local.get(STORAGE_KEYS as unknown as string[]);
  return {
    services: (result.services as Record<string, DetectedService>) || {},
    events: (result.events as EventLog[]) || [],
    cspReports: (result.cspReports as CSPReport[]) || [],
    cspConfig: (result.cspConfig as CSPConfig) || DEFAULT_CSP_CONFIG,
  };
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

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

export async function getServiceCount(): Promise<number> {
  const services = await getStorageKey("services");
  return Object.keys(services).length;
}

export async function clearCSPReports(): Promise<void> {
  await chrome.storage.local.remove(["cspReports"]);
}
