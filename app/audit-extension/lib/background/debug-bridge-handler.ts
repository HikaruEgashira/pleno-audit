import type { DoHMonitorConfig, DoHRequestRecord } from "@pleno-audit/extension-runtime";

interface DebugBridgeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface DebugBridgeHandlerDependencies {
  getOrInitParquetStore: () => Promise<{
    getEvents: (options: { limit: number }) => Promise<{
      data: Array<{
        id: string;
        type: string;
        domain: string;
        timestamp: number;
        details: unknown;
      }>;
      total: number;
    }>;
    clearAll: () => Promise<void>;
  }>;
  getDoHMonitorConfig: () => Promise<DoHMonitorConfig>;
  setDoHMonitorConfig: (config: Partial<DoHMonitorConfig>) => Promise<{ success: boolean }>;
  getDoHRequests: (options?: { limit?: number; offset?: number }) => Promise<{
    requests: DoHRequestRecord[];
    total: number;
  }>;
}

type DebugHandler = (data: unknown) => Promise<DebugBridgeResponse>;

function parseEventDetails(details: unknown): unknown {
  return typeof details === "string" ? JSON.parse(details) : details;
}

function normalizeUrl(rawUrl: string): string {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  return `https://${rawUrl}`;
}

export function createDebugBridgeHandler(
  deps: DebugBridgeHandlerDependencies,
): (type: string, data: unknown) => Promise<DebugBridgeResponse> {
  const handlers = new Map<string, DebugHandler>([
    ["DEBUG_EVENTS_LIST", async (rawData) => {
      const params = rawData as { limit?: number; type?: string } | undefined;
      const store = await deps.getOrInitParquetStore();
      const result = await store.getEvents({ limit: params?.limit || 100 });
      const events = result.data.map((event) => ({
        id: event.id,
        type: event.type,
        domain: event.domain,
        timestamp: event.timestamp,
        details: parseEventDetails(event.details),
      }));

      const filteredEvents = params?.type
        ? events.filter((event) => event.type === params.type)
        : events;
      return { success: true, data: filteredEvents };
    }],
    ["DEBUG_EVENTS_COUNT", async () => {
      const store = await deps.getOrInitParquetStore();
      const result = await store.getEvents({ limit: 0 });
      return { success: true, data: result.total };
    }],
    ["DEBUG_EVENTS_CLEAR", async () => {
      const store = await deps.getOrInitParquetStore();
      await store.clearAll();
      return { success: true };
    }],
    ["DEBUG_TAB_OPEN", async (rawData) => {
      const params = rawData as { url: string };
      const url = normalizeUrl(params.url);
      const tab = await chrome.tabs.create({ url, active: true });
      return { success: true, data: { tabId: tab.id, url: tab.url || url } };
    }],
    ["DEBUG_DOH_CONFIG_GET", async () => {
      const config = await deps.getDoHMonitorConfig();
      return { success: true, data: config };
    }],
    ["DEBUG_DOH_CONFIG_SET", async (rawData) => {
      const params = rawData as Partial<DoHMonitorConfig>;
      await deps.setDoHMonitorConfig(params);
      return { success: true };
    }],
    ["DEBUG_DOH_REQUESTS", async (rawData) => {
      const params = rawData as { limit?: number; offset?: number } | undefined;
      const result = await deps.getDoHRequests(params);
      return { success: true, data: result };
    }],
  ]);

  return async (type: string, data: unknown): Promise<DebugBridgeResponse> => {
    const handler = handlers.get(type);
    if (!handler) {
      return { success: false, error: `Unknown debug message type: ${type}` };
    }

    try {
      return await handler(data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };
}
