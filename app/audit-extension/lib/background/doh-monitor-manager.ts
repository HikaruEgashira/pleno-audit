import type {
  DoHMonitor,
  DoHMonitorConfig,
  DoHRequestRecord,
  Logger,
} from "@pleno-audit/extension-runtime";

interface DoHMonitorManagerDeps {
  logger: Logger;
  defaultConfig: DoHMonitorConfig;
  createDoHMonitor: (config: DoHMonitorConfig) => DoHMonitor;
  getStorage: () => Promise<{
    doHMonitorConfig?: DoHMonitorConfig;
    doHRequests?: DoHRequestRecord[];
  }>;
  setStorage: (storage: {
    doHMonitorConfig?: DoHMonitorConfig;
    doHRequests?: DoHRequestRecord[];
  }) => Promise<void>;
}

export function createDoHMonitorManager(deps: DoHMonitorManagerDeps) {
  let doHMonitor: DoHMonitor | null = null;

  async function getDoHMonitorConfig(): Promise<DoHMonitorConfig> {
    const storage = await deps.getStorage();
    return storage.doHMonitorConfig || deps.defaultConfig;
  }

  async function setDoHMonitorConfig(
    config: Partial<DoHMonitorConfig>
  ): Promise<{ success: boolean }> {
    const storage = await deps.getStorage();
    storage.doHMonitorConfig = {
      ...deps.defaultConfig,
      ...storage.doHMonitorConfig,
      ...config,
    };
    await deps.setStorage(storage);

    if (doHMonitor) {
      await doHMonitor.updateConfig(storage.doHMonitorConfig);
    }

    return { success: true };
  }

  async function getDoHRequests(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ requests: DoHRequestRecord[]; total: number }> {
    const storage = await deps.getStorage();
    const allRequests = storage.doHRequests || [];
    const total = allRequests.length;

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const sorted = [...allRequests].sort((a, b) => b.timestamp - a.timestamp);
    const requests = sorted.slice(offset, offset + limit);

    return { requests, total };
  }

  async function startDoHMonitor(): Promise<void> {
    const storage = await deps.getStorage();
    const config = storage.doHMonitorConfig ?? deps.defaultConfig;
    doHMonitor = deps.createDoHMonitor(config);
    doHMonitor.start().catch((err) =>
      deps.logger.error("Failed to start DoH monitor:", err)
    );

    doHMonitor.onRequest(async (record: DoHRequestRecord) => {
      try {
        const storage = await deps.getStorage();
        if (!storage.doHRequests) {
          storage.doHRequests = [];
        }
        storage.doHRequests.push(record);

        const maxRequests =
          storage.doHMonitorConfig?.maxStoredRequests ?? 1000;
        if (storage.doHRequests.length > maxRequests) {
          storage.doHRequests = storage.doHRequests.slice(-maxRequests);
        }

        await deps.setStorage(storage);
        deps.logger.debug("DoH request stored:", record.domain);

        const config = storage.doHMonitorConfig ?? deps.defaultConfig;
        if (config.action === "alert" || config.action === "block") {
          await chrome.notifications.create(`doh-${record.id}`,
            {
              type: "basic",
              iconUrl: "icon-128.png",
              title: "DoH Traffic Detected",
              message: `DNS over HTTPS request to ${record.domain} (${record.detectionMethod})`,
              priority: 0,
            }
          );
        }
      } catch (error) {
        deps.logger.error("Failed to store DoH request:", error);
      }
    });
  }

  function getMonitor(): DoHMonitor | null {
    return doHMonitor;
  }

  return {
    getDoHMonitorConfig,
    setDoHMonitorConfig,
    getDoHRequests,
    startDoHMonitor,
    getMonitor,
  };
}
