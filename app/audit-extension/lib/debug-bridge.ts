/**
 * Debug Bridge for CLI communication
 *
 * This module connects to the CLI's WebSocket server when running in dev mode.
 * It handles debug commands and forwards them to the background script.
 *
 * Only active in development mode.
 */

import { setDebuggerSink, createLogger, type LogEntry } from "@pleno-audit/extension-runtime";
import { ParquetStore } from "@pleno-audit/parquet-storage";

const logger = createLogger("debug-bridge");

// Shared ParquetStore instance
let parquetStore: ParquetStore | null = null;

async function getParquetStore(): Promise<ParquetStore> {
  if (!parquetStore) {
    parquetStore = new ParquetStore();
    await parquetStore.init();
  }
  return parquetStore;
}

declare const __DEBUG_PORT__: string;
const DEBUG_PORT = typeof __DEBUG_PORT__ !== "undefined" ? __DEBUG_PORT__ : "9222";
const DEBUG_SERVER_URL = `ws://localhost:${DEBUG_PORT}/debug`;
const RECONNECT_INTERVAL = 5000;
const LOG_BUFFER_SIZE = 100;

interface DebugMessage {
  type: string;
  id?: string;
  data?: unknown;
}

interface DebugResponse {
  id?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let logBuffer: LogEntry[] = [];

/**
 * Send log entry to debug server
 */
function sendLog(entry: LogEntry): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "DEBUG_LOG",
        data: entry,
      })
    );
  } else {
    // Buffer logs when disconnected
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_SIZE) {
      logBuffer.shift();
    }
  }
}

/**
 * Flush buffered logs
 */
function flushLogBuffer(): void {
  if (ws?.readyState !== WebSocket.OPEN || logBuffer.length === 0) {
    return;
  }

  for (const entry of logBuffer) {
    ws.send(
      JSON.stringify({
        type: "DEBUG_LOG",
        data: entry,
      })
    );
  }
  logBuffer = [];
}

/**
 * Initialize debug bridge (only in dev mode)
 */
export function initDebugBridge(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  // Set up logger sink to forward logs to debug server
  setDebuggerSink(sendLog);

  logger.info("Initializing...");
  connect();
}

/**
 * Connect to debug server
 */
function connect(): void {
  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    ws = new WebSocket(DEBUG_SERVER_URL);

    ws.onopen = () => {
      logger.info("Connected to debug server");
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Send initial connection info
      sendResponse({
        success: true,
        data: {
          type: "connected",
          extensionId: chrome.runtime.id,
          version: chrome.runtime.getManifest().version,
          devMode: true,
        },
      });

      // Flush any buffered logs
      flushLogBuffer();
    };

    ws.onmessage = async (event) => {
      try {
        const message: DebugMessage = JSON.parse(event.data as string);
        const response = await handleMessage(message);
        sendResponse({ id: message.id, ...response });
      } catch (error) {
        logger.error("Error handling message:", error);
      }
    };

    ws.onclose = (event) => {
      logger.info(`Disconnected from debug server (code: ${event.code}, reason: ${event.reason || "none"})`);
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      logger.error("WebSocket error:", error);
      ws?.close();
    };
  } catch (error) {
    logger.error("Connection error:", error);
    scheduleReconnect();
  }
}

/**
 * Schedule reconnection attempt
 */
function scheduleReconnect(): void {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL);
}

/**
 * Send response to debug server
 */
function sendResponse(response: DebugResponse): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

/**
 * Handle incoming debug message
 */
async function handleMessage(
  message: DebugMessage
): Promise<Omit<DebugResponse, "id">> {
  const { type, data } = message;

  try {
    switch (type) {
      case "DEBUG_PING":
        return {
          success: true,
          data: {
            extensionId: chrome.runtime.id,
            version: chrome.runtime.getManifest().version,
            devMode: true,
            timestamp: Date.now(),
          },
        };

      case "DEBUG_SNAPSHOT":
        return await getSnapshot();

      case "DEBUG_STORAGE_LIST":
        return await getStorageKeys();

      case "DEBUG_STORAGE_GET":
        return await getStorageValue(data as { key: string });

      case "DEBUG_STORAGE_SET":
        return await setStorageValue(data as { key: string; value: unknown });

      case "DEBUG_STORAGE_CLEAR":
        return await clearStorage();

      case "DEBUG_SERVICES_LIST":
        return await getServices();

      case "DEBUG_SERVICES_GET":
        return await getService(data as { domain: string });

      case "DEBUG_SERVICES_CLEAR":
        return await clearServices();

      case "DEBUG_EVENTS_LIST":
        return await getEvents(data as { limit?: number; type?: string });

      case "DEBUG_EVENTS_COUNT":
        return await getEventsCount();

      case "DEBUG_EVENTS_CLEAR":
        return await clearEvents();

      case "DEBUG_TAB_OPEN":
        return await openTab(data as { url: string });

      case "DEBUG_DOH_CONFIG_GET":
        return await getDoHConfig();

      case "DEBUG_DOH_CONFIG_SET":
        return await setDoHConfig(data as { action?: string; maxStoredRequests?: number });

      case "DEBUG_DOH_REQUESTS":
        return await getDoHRequests(data as { limit?: number; offset?: number });

      case "DEBUG_NETWORK_CONFIG_GET":
        return await getNetworkConfig();

      case "DEBUG_NETWORK_CONFIG_SET":
        return await setNetworkConfig(data as { enabled?: boolean; captureAllRequests?: boolean; excludeOwnExtension?: boolean });

      case "DEBUG_NETWORK_REQUESTS_GET":
        return await getNetworkRequests(data as { limit?: number; initiatorType?: string });

      default:
        // Forward to background script as a regular message
        return await forwardToBackground(type, data);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get full snapshot of extension state
 */
async function getSnapshot(): Promise<Omit<DebugResponse, "id">> {
  try {
    const storage = await chrome.storage.local.get(null);
    const services = storage.services || {};

    return {
      success: true,
      data: {
        storage,
        services,
        extensionId: chrome.runtime.id,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    logger.error("getSnapshot error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Storage operations
 */
async function getStorageKeys(): Promise<Omit<DebugResponse, "id">> {
  const storage = await chrome.storage.local.get(null);
  return { success: true, data: Object.keys(storage) };
}

async function getStorageValue(params: {
  key: string;
}): Promise<Omit<DebugResponse, "id">> {
  const storage = await chrome.storage.local.get(params.key);
  return { success: true, data: storage[params.key] };
}

/**
 * Validate storage key to prevent prototype pollution
 */
function isValidStorageKey(key: string): boolean {
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  return typeof key === "string" && key.length > 0 && !dangerousKeys.includes(key);
}

async function setStorageValue(params: {
  key: string;
  value: unknown;
}): Promise<Omit<DebugResponse, "id">> {
  if (!isValidStorageKey(params.key)) {
    return { success: false, error: "Invalid storage key" };
  }
  // Use Object.create(null) to prevent prototype pollution via property injection
  const data: Record<string, unknown> = Object.create(null);
  data[params.key] = params.value;
  await chrome.storage.local.set(data);
  return { success: true };
}

async function clearStorage(): Promise<Omit<DebugResponse, "id">> {
  await chrome.storage.local.clear();
  return { success: true };
}

/**
 * Services operations
 */
async function getServices(): Promise<Omit<DebugResponse, "id">> {
  const storage = await chrome.storage.local.get("services");
  return { success: true, data: storage.services || {} };
}

async function getService(params: {
  domain: string;
}): Promise<Omit<DebugResponse, "id">> {
  const storage = await chrome.storage.local.get("services");
  const services = storage.services || {};
  return { success: true, data: services[params.domain] || null };
}

async function clearServices(): Promise<Omit<DebugResponse, "id">> {
  await chrome.storage.local.remove("services");
  return { success: true };
}

/**
 * Events operations
 * Uses ParquetStore directly
 */
async function getEvents(params: {
  limit?: number;
  type?: string;
}): Promise<Omit<DebugResponse, "id">> {
  try {
    const store = await getParquetStore();
    const result = await store.getEvents({
      limit: params.limit || 100,
    });

    // Convert ParquetEvent to a more readable format
    const events = result.data.map((e) => ({
      id: e.id,
      type: e.type,
      domain: e.domain,
      timestamp: e.timestamp,
      details: typeof e.details === "string" ? JSON.parse(e.details) : e.details,
    }));

    // Filter by type if specified
    const filteredEvents = params.type
      ? events.filter((e) => e.type === params.type)
      : events;

    return {
      success: true,
      data: filteredEvents,
    };
  } catch (error) {
    logger.error("getEvents error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get events",
    };
  }
}

async function getEventsCount(): Promise<Omit<DebugResponse, "id">> {
  try {
    const store = await getParquetStore();
    const result = await store.getEvents({ limit: 0 });

    return {
      success: true,
      data: result.total,
    };
  } catch (error) {
    logger.error("getEventsCount error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get events count",
    };
  }
}

async function clearEvents(): Promise<Omit<DebugResponse, "id">> {
  try {
    const store = await getParquetStore();
    await store.clearAll();

    return {
      success: true,
    };
  } catch (error) {
    logger.error("clearEvents error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear events",
    };
  }
}

/**
 * DoH Monitor operations
 */
const DEFAULT_DOH_CONFIG = {
  action: "detect" as const,
  maxStoredRequests: 1000,
};

async function getDoHConfig(): Promise<Omit<DebugResponse, "id">> {
  try {
    const storage = await chrome.storage.local.get("doHMonitorConfig");
    return {
      success: true,
      data: storage.doHMonitorConfig || DEFAULT_DOH_CONFIG,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get DoH config",
    };
  }
}

async function setDoHConfig(params: {
  action?: string;
  maxStoredRequests?: number;
}): Promise<Omit<DebugResponse, "id">> {
  try {
    const storage = await chrome.storage.local.get("doHMonitorConfig");
    const currentConfig = storage.doHMonitorConfig || DEFAULT_DOH_CONFIG;
    const newConfig = { ...currentConfig, ...params };
    await chrome.storage.local.set({ doHMonitorConfig: newConfig });

    // Notify background to update monitor config via message
    chrome.runtime.sendMessage({
      type: "SET_DOH_MONITOR_CONFIG",
      data: params,
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set DoH config",
    };
  }
}

async function getDoHRequests(params?: {
  limit?: number;
  offset?: number;
}): Promise<Omit<DebugResponse, "id">> {
  try {
    const storage = await chrome.storage.local.get("doHRequests");
    const allRequests = storage.doHRequests || [];
    const total = allRequests.length;

    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;

    // Sort by timestamp descending (newest first)
    const sorted = [...allRequests].sort((a: { timestamp: number }, b: { timestamp: number }) => b.timestamp - a.timestamp);
    const requests = sorted.slice(offset, offset + limit);

    return {
      success: true,
      data: { requests, total },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get DoH requests",
    };
  }
}

/**
 * Network Monitor operations
 * Parquet-based network request storage
 */
const DEFAULT_NETWORK_CONFIG = {
  enabled: true,
  captureAllRequests: true,
  excludeOwnExtension: true,
  excludedDomains: [] as string[],
  excludedExtensions: [] as string[],
};

async function getNetworkConfig(): Promise<Omit<DebugResponse, "id">> {
  try {
    const storage = await chrome.storage.local.get("networkMonitorConfig");
    return {
      success: true,
      data: storage.networkMonitorConfig || DEFAULT_NETWORK_CONFIG,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get network monitor config",
    };
  }
}

async function setNetworkConfig(params: {
  enabled?: boolean;
  captureAllRequests?: boolean;
  excludeOwnExtension?: boolean;
}): Promise<Omit<DebugResponse, "id">> {
  try {
    const storage = await chrome.storage.local.get("networkMonitorConfig");
    const currentConfig = storage.networkMonitorConfig || DEFAULT_NETWORK_CONFIG;
    const newConfig = { ...currentConfig, ...params };
    await chrome.storage.local.set({ networkMonitorConfig: newConfig });

    chrome.runtime.sendMessage({
      type: "SET_NETWORK_MONITOR_CONFIG",
      data: newConfig,
    }).catch(() => {});

    return { success: true, data: newConfig };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set network monitor config",
    };
  }
}

async function getNetworkRequests(params?: {
  limit?: number;
  initiatorType?: string;
}): Promise<Omit<DebugResponse, "id">> {
  try {
    // Source of truth is background's Parquet store.
    const result = await chrome.runtime.sendMessage({
      type: "GET_NETWORK_REQUESTS",
      data: {
        limit: params?.limit,
        initiatorType: params?.initiatorType,
      },
    });

    return { success: true, data: result?.requests || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get network requests",
    };
  }
}

/**
 * Tab operations
 */
async function openTab(params: { url: string }): Promise<Omit<DebugResponse, "id">> {
  try {
    let url = params.url;
    // Prepend https:// if no protocol specified
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    const tab = await chrome.tabs.create({ url, active: true });
    return {
      success: true,
      data: {
        tabId: tab.id,
        url: tab.url || url,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to open tab",
    };
  }
}

/**
 * Forward message to background script
 * Note: This doesn't work because debug-bridge runs in the same context as background.
 */
async function forwardToBackground(
  type: string,
  _data: unknown
): Promise<Omit<DebugResponse, "id">> {
  return {
    success: false,
    error: `Unknown message type: ${type}. Debug bridge cannot forward messages to background.`,
  };
}
