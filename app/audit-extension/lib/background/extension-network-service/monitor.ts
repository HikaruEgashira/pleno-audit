import {
  createExtensionMonitor,
  DEFAULT_NETWORK_MONITOR_CONFIG,
  type ExtensionMonitorConfig,
  type NetworkMonitorConfig,
  type NetworkRequestRecord,
} from "@pleno-audit/extension-runtime";
import { networkRequestRecordToParquetRecord } from "@pleno-audit/parquet-storage";
import type { ExtensionNetworkContext } from "./types";

export async function getNetworkMonitorConfig(
  context: ExtensionNetworkContext
): Promise<NetworkMonitorConfig> {
  const storage = await context.deps.getStorage();
  const storedConfig = storage.networkMonitorConfig ?? {};
  const sanitizedStored = Object.fromEntries(
    Object.entries(storedConfig).filter(([, value]) => value !== undefined)
  );
  return {
    ...DEFAULT_NETWORK_MONITOR_CONFIG,
    ...sanitizedStored,
  };
}

export async function initExtensionMonitor(context: ExtensionNetworkContext): Promise<void> {
  if (context.state.extensionMonitor) {
    context.deps.logger.debug("Extension monitor already started");
    return;
  }

  const networkConfig = await getNetworkMonitorConfig(context);
  if (!networkConfig.enabled) return;

  const config: ExtensionMonitorConfig = {
    enabled: networkConfig.enabled,
    excludeOwnExtension: networkConfig.excludeOwnExtension,
    excludedExtensions: networkConfig.excludedExtensions,
    maxStoredRequests: 10000,
  };

  context.state.extensionMonitor = createExtensionMonitor(config, context.deps.getRuntimeId());

  context.state.extensionMonitor.onRequest((record) => {
    context.state.networkRequestBuffer.push(record as NetworkRequestRecord);

    void context.deps
      .addEvent({
        type: "extension_request",
        domain: record.domain,
        timestamp: record.timestamp,
        details: {
          extensionId: record.extensionId,
          extensionName: record.extensionName,
          url: record.url,
          method: record.method,
          resourceType: record.resourceType,
          initiatorType: (record as NetworkRequestRecord).initiatorType,
        },
      })
      .catch((error) => {
        context.deps.logger.error("Failed to add extension request event:", error);
      });
  });

  await context.state.extensionMonitor.start();
  context.deps.logger.info("Extension monitor started");
}

export async function setNetworkMonitorConfig(
  context: ExtensionNetworkContext,
  newConfig: NetworkMonitorConfig
): Promise<{ success: boolean }> {
  try {
    await context.deps.setStorage({ networkMonitorConfig: newConfig });

    if (context.state.extensionMonitor) {
      await context.state.extensionMonitor.stop();
      context.state.extensionMonitor = null;
    }

    if (newConfig.enabled) {
      await initExtensionMonitor(context);
    }

    return { success: true };
  } catch (error) {
    context.deps.logger.error("Error setting network monitor config:", error);
    return { success: false };
  }
}

export async function flushNetworkRequestBuffer(context: ExtensionNetworkContext): Promise<void> {
  if (context.state.networkRequestBuffer.length === 0) return;

  const toFlush = context.state.networkRequestBuffer.splice(
    0,
    context.state.networkRequestBuffer.length
  );
  try {
    const store = await context.deps.getOrInitParquetStore();
    const records = toFlush.map((record) => networkRequestRecordToParquetRecord(record));
    await store.appendRows("network-requests", records);
  } catch (error) {
    context.state.networkRequestBuffer.unshift(...toFlush);
    context.deps.logger.error("Failed to flush network requests to Parquet:", error);
  }
}

export async function checkDNRMatchesHandler(context: ExtensionNetworkContext): Promise<void> {
  if (!context.state.extensionMonitor) return;
  try {
    await context.state.extensionMonitor.checkDNRMatches();
  } catch (error) {
    context.deps.logger.debug("DNR match check failed:", error);
  }
}

export function getKnownExtensions(
  context: ExtensionNetworkContext
): Record<string, { id: string; name: string; version: string; enabled: boolean; icons?: { size: number; url: string }[] }> {
  if (!context.state.extensionMonitor) return {};
  const map = context.state.extensionMonitor.getKnownExtensions();
  return Object.fromEntries(map);
}
