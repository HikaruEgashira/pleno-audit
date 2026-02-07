import { DEFAULT_NETWORK_CONFIG } from "./constants.js";
import type { DebugHandlerResult } from "./types.js";

export async function getNetworkConfig(): Promise<DebugHandlerResult> {
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

export async function setNetworkConfig(params: {
  enabled?: boolean;
  captureAllRequests?: boolean;
  excludeOwnExtension?: boolean;
}): Promise<DebugHandlerResult> {
  try {
    const storage = await chrome.storage.local.get("networkMonitorConfig");
    const currentConfig = storage.networkMonitorConfig || DEFAULT_NETWORK_CONFIG;
    const newConfig = { ...currentConfig, ...params };
    await chrome.storage.local.set({ networkMonitorConfig: newConfig });

    chrome.runtime
      .sendMessage({
        type: "SET_NETWORK_MONITOR_CONFIG",
        data: newConfig,
      })
      .catch(() => {});

    return { success: true, data: newConfig };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set network monitor config",
    };
  }
}

export async function getNetworkRequests(params?: {
  limit?: number;
  initiatorType?: string;
}): Promise<DebugHandlerResult> {
  try {
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
