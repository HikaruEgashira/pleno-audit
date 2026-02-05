import type {
  DoHMonitor,
  DoHMonitorConfig,
  DoHRequestRecord,
} from "@pleno-audit/extension-runtime";
import { DEFAULT_DOH_MONITOR_CONFIG } from "@pleno-audit/extension-runtime";

interface LoggerLike {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface DoHStorage {
  doHMonitorConfig?: DoHMonitorConfig;
  doHRequests?: DoHRequestRecord[];
}

interface DoHMonitorServiceDependencies {
  logger: LoggerLike;
  getStorage: () => Promise<DoHStorage>;
  setStorage: (data: DoHStorage) => Promise<void>;
  createDoHMonitor: (config: DoHMonitorConfig) => DoHMonitor;
  notify: (record: DoHRequestRecord) => Promise<void>;
}

export interface DoHMonitorService {
  start: () => Promise<void>;
  getDoHMonitorConfig: () => Promise<DoHMonitorConfig>;
  setDoHMonitorConfig: (config: Partial<DoHMonitorConfig>) => Promise<{ success: boolean }>;
  getDoHRequests: (options?: { limit?: number; offset?: number }) => Promise<{ requests: DoHRequestRecord[]; total: number }>;
}

export function createDoHMonitorService(deps: DoHMonitorServiceDependencies): DoHMonitorService {
  let monitor: DoHMonitor | null = null;

  async function getDoHMonitorConfig(): Promise<DoHMonitorConfig> {
    const storage = await deps.getStorage();
    return storage.doHMonitorConfig || DEFAULT_DOH_MONITOR_CONFIG;
  }

  async function setDoHMonitorConfig(config: Partial<DoHMonitorConfig>): Promise<{ success: boolean }> {
    const storage = await deps.getStorage();
    storage.doHMonitorConfig = { ...DEFAULT_DOH_MONITOR_CONFIG, ...storage.doHMonitorConfig, ...config };
    await deps.setStorage(storage);

    if (monitor) {
      await monitor.updateConfig(storage.doHMonitorConfig);
    }

    return { success: true };
  }

  async function getDoHRequests(options?: { limit?: number; offset?: number }): Promise<{ requests: DoHRequestRecord[]; total: number }> {
    const storage = await deps.getStorage();
    const allRequests = storage.doHRequests || [];
    const total = allRequests.length;

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const sorted = [...allRequests].sort((a, b) => b.timestamp - a.timestamp);
    const requests = sorted.slice(offset, offset + limit);

    return { requests, total };
  }

  async function handleRequest(record: DoHRequestRecord): Promise<void> {
    try {
      const storage = await deps.getStorage();
      const requests = storage.doHRequests || [];
      requests.push(record);

      const maxRequests = storage.doHMonitorConfig?.maxStoredRequests ?? 1000;
      storage.doHRequests = requests.length > maxRequests ? requests.slice(-maxRequests) : requests;

      await deps.setStorage(storage);
      deps.logger.debug("DoH request stored:", record.domain);

      const config = storage.doHMonitorConfig ?? DEFAULT_DOH_MONITOR_CONFIG;
      if (config.action === "alert" || config.action === "block") {
        await deps.notify(record);
      }
    } catch (error) {
      deps.logger.error("Failed to store DoH request:", error);
    }
  }

  async function start(): Promise<void> {
    const config = await getDoHMonitorConfig();
    monitor = deps.createDoHMonitor(config);
    await monitor.start();
    monitor.onRequest((record) => {
      void handleRequest(record);
    });
  }

  return {
    start,
    getDoHMonitorConfig,
    setDoHMonitorConfig,
    getDoHRequests,
  };
}
