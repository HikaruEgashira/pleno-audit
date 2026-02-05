import type { DetectedService } from "@pleno-audit/detectors";
import type { CSPConfig, CSPReport } from "@pleno-audit/csp";
import { DEFAULT_CSP_CONFIG } from "@pleno-audit/csp";
import { DEFAULT_DETECTION_CONFIG, type DetectionConfig, type NotificationConfig } from "@pleno-audit/extension-runtime";
import type { PolicyConfig } from "@pleno-audit/alerts";

export interface StorageData {
  services: Record<string, DetectedService>;
  cspReports: CSPReport[];
  cspConfig: CSPConfig;
  detectionConfig: DetectionConfig;
  policyConfig?: PolicyConfig;
  notificationConfig?: NotificationConfig;
}

export interface StorageAccess {
  initStorage: () => Promise<StorageData>;
  saveStorage: (data: Partial<StorageData>) => Promise<void>;
  queueStorageOperation: <T>(operation: () => Promise<T>) => Promise<T>;
}

export function createStorageAccess(): StorageAccess {
  let storageQueue: Promise<void> = Promise.resolve();

  function queueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      storageQueue = storageQueue
        .then(() => operation())
        .then(resolve)
        .catch(reject);
    });
  }

  async function initStorage(): Promise<StorageData> {
    const result = await chrome.storage.local.get([
      "services",
      "cspReports",
      "cspConfig",
      "detectionConfig",
    ]);
    return {
      services: result.services || {},
      cspReports: result.cspReports || [],
      cspConfig: result.cspConfig || DEFAULT_CSP_CONFIG,
      detectionConfig: result.detectionConfig || DEFAULT_DETECTION_CONFIG,
    };
  }

  async function saveStorage(data: Partial<StorageData>) {
    await chrome.storage.local.set(data);
  }

  return {
    initStorage,
    saveStorage,
    queueStorageOperation,
  };
}
