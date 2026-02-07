import type { Logger } from "@pleno-audit/extension-runtime";
import {
  DEFAULT_DOH_MONITOR_CONFIG,
  type DoHMonitor,
  type DoHMonitorConfig,
  type DoHRequestRecord,
} from "@pleno-audit/extension-runtime";

interface DoHMonitorServiceParams {
  logger: Logger;
  getStorage: () => Promise<{ doHMonitorConfig?: DoHMonitorConfig; doHRequests?: DoHRequestRecord[] }>;
  setStorage: (data: { doHMonitorConfig?: DoHMonitorConfig; doHRequests?: DoHRequestRecord[] }) => Promise<void>;
  createDoHMonitor: (config: DoHMonitorConfig) => DoHMonitor;
}

export function createDoHMonitorService(params: DoHMonitorServiceParams) {
  let monitor: DoHMonitor | null = null;

  async function getDoHMonitorConfig(): Promise<DoHMonitorConfig> {
    const storage = await params.getStorage();
    return storage.doHMonitorConfig || DEFAULT_DOH_MONITOR_CONFIG;
  }

  async function setDoHMonitorConfig(
    config: Partial<DoHMonitorConfig>
  ): Promise<{ success: boolean }> {
    const storage = await params.getStorage();
    storage.doHMonitorConfig = {
      ...DEFAULT_DOH_MONITOR_CONFIG,
      ...storage.doHMonitorConfig,
      ...config,
    };
    await params.setStorage(storage);

    if (monitor) {
      await monitor.updateConfig(storage.doHMonitorConfig);
    }

    return { success: true };
  }

  async function getDoHRequests(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ requests: DoHRequestRecord[]; total: number }> {
    const storage = await params.getStorage();
    const allRequests = storage.doHRequests || [];
    const total = allRequests.length;

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const sorted = [...allRequests].sort((a, b) => b.timestamp - a.timestamp);
    const requests = sorted.slice(offset, offset + limit);

    return { requests, total };
  }

  function handleDoHRequest(record: DoHRequestRecord) {
    void (async () => {
      try {
        const storage = await params.getStorage();
        if (!storage.doHRequests) {
          storage.doHRequests = [];
        }
        storage.doHRequests.push(record);

        const maxRequests = storage.doHMonitorConfig?.maxStoredRequests ?? 1000;
        if (storage.doHRequests.length > maxRequests) {
          storage.doHRequests = storage.doHRequests.slice(-maxRequests);
        }

        await params.setStorage(storage);
        params.logger.debug("DoH request stored:", record.domain);

        const config = storage.doHMonitorConfig ?? DEFAULT_DOH_MONITOR_CONFIG;
        if (config.action === "alert" || config.action === "block") {
          await chrome.notifications.create(`doh-${record.id}`, {
            type: "basic",
            iconUrl: "icon-128.png",
            title: "DoH Traffic Detected",
            message: `DNS over HTTPS request to ${record.domain} (${record.detectionMethod})`,
            priority: 0,
          });
        }
      } catch (error) {
        params.logger.error("Failed to store DoH request:", error);
      }
    })();
  }

  async function start(): Promise<void> {
    monitor = params.createDoHMonitor(DEFAULT_DOH_MONITOR_CONFIG);
    const startPromise = monitor.start();
    monitor.onRequest(handleDoHRequest);
    await startPromise;
  }

  return {
    getDoHMonitorConfig,
    setDoHMonitorConfig,
    getDoHRequests,
    start,
  };
}

export type DoHMonitorService = ReturnType<typeof createDoHMonitorService>;
