declare const __DEBUG_PORT__: string;
const DEBUG_PORT = typeof __DEBUG_PORT__ !== "undefined" ? __DEBUG_PORT__ : "9222";
const DEBUG_SERVER_URL = `ws://localhost:${DEBUG_PORT}/debug`;
const RECONNECT_INTERVAL = 5000;
const KEEPALIVE_INTERVAL = 25000; // 25 seconds - keep offscreen document alive

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
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

function startKeepAlive(): void {
  if (keepAliveTimer) return;

  keepAliveTimer = setInterval(async () => {
    try {
      await chrome.storage.local.get("__keepalive__");
    } catch {
      // noop
    }
  }, KEEPALIVE_INTERVAL);
}

export function initDebugWebSocket(): void {
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  startKeepAlive();
  connect();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "DEBUG_BRIDGE_LOG") {
      sendToServer({
        type: "DEBUG_LOG",
        data: message.data,
      });
      return false;
    }

    if (message.type === "DEBUG_BRIDGE_REQUEST") {
      handleBackgroundRequest(message.request, message.requestId)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });
      return true;
    }

    return false;
  });
}

function connect(): void {
  if (ws?.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    ws = new WebSocket(DEBUG_SERVER_URL);

    ws.onopen = () => {
      console.log("[debug-ws] Connected to debug server");
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      chrome.runtime.sendMessage({ type: "DEBUG_BRIDGE_CONNECTED" }).catch(() => {});
      const version = chrome.runtime.getManifest?.()?.version ?? "unknown";
      sendToServer({
        success: true,
        data: {
          type: "connected",
          extensionId: chrome.runtime.id,
          version,
          devMode: true,
          context: "offscreen",
        },
      });
    };

    ws.onmessage = async (event) => {
      try {
        const message: DebugMessage = JSON.parse(event.data as string);
        const response = await handleMessage(message);
        sendToServer({ id: message.id, ...response });
      } catch (error) {
        console.error("[debug-ws] Error handling message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log(`[debug-ws] Disconnected (code: ${event.code}, reason: ${event.reason || "none"})`);
      ws = null;
      chrome.runtime.sendMessage({ type: "DEBUG_BRIDGE_DISCONNECTED" }).catch(() => {});
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error("[debug-ws] WebSocket error:", error);
      ws?.close();
    };
  } catch (error) {
    console.error("[debug-ws] Connection error:", error);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL);
}

function sendToServer(data: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

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
            version: chrome.runtime.getManifest?.()?.version ?? "unknown",
            devMode: true,
            timestamp: Date.now(),
            context: "offscreen",
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
      case "DEBUG_EVENTS_COUNT":
      case "DEBUG_EVENTS_CLEAR":
        return await forwardToBackground(type, data);

      case "DEBUG_TAB_OPEN":
        return await forwardToBackground(type, data);

      default:
        return await forwardToBackground(type, data);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function getSnapshot(): Promise<Omit<DebugResponse, "id">> {
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
}

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

async function setStorageValue(params: {
  key: string;
  value: unknown;
}): Promise<Omit<DebugResponse, "id">> {
  await chrome.storage.local.set({ [params.key]: params.value });
  return { success: true };
}

async function clearStorage(): Promise<Omit<DebugResponse, "id">> {
  await chrome.storage.local.clear();
  return { success: true };
}

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

async function forwardToBackground(
  type: string,
  data: unknown
): Promise<Omit<DebugResponse, "id">> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "DEBUG_BRIDGE_FORWARD",
      debugType: type,
      debugData: data,
    });
    return response || { success: false, error: "No response from background" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to forward to background",
    };
  }
}
