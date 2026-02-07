import {
  checkMigrationNeeded,
  clearAllStorage,
  createDoHMonitor,
  ensureOffscreenDocument,
  getEnterpriseManager,
  getSSOManager,
  getStorage,
  migrateToDatabase,
  registerDoHMonitorListener,
  registerExtensionMonitorListener,
  setStorage,
} from "@pleno-audit/extension-runtime";
import { createRuntimeMessageHandlers, runAsyncMessageHandler, type RuntimeMessage } from "../lib/background/runtime-handlers";
import { createBackgroundContext } from "../lib/background/entrypoint/context";
import { createDoHMonitorService } from "../lib/background/entrypoint/doh-monitor-service";
import { createExtensionNetworkGateway } from "../lib/background/entrypoint/extension-network-gateway";
import { createBackgroundInitializers } from "../lib/background/entrypoint/initializers";
import { createRuntimeHandlerDependencies } from "../lib/background/entrypoint/runtime-deps";
import { registerAlarmListeners, registerRecurringAlarms } from "../lib/background/entrypoint/alarms";
import { registerCookieMonitor } from "../lib/background/entrypoint/cookie-monitor";
import { createClearAllData } from "../lib/background/entrypoint/clear-all-data";

const context = createBackgroundContext();

const extensionNetwork = createExtensionNetworkGateway({
  deps: {
    logger: context.logger,
    getStorage,
    setStorage,
    getOrInitParquetStore: context.backgroundEvents.getOrInitParquetStore,
    addEvent: (event) => context.backgroundEvents.addEvent(event),
    getAlertManager: context.backgroundAlerts.getAlertManager,
    getRuntimeId: () => chrome.runtime.id,
  },
});

const doHMonitorService = createDoHMonitorService({
  logger: context.logger,
  getStorage,
  setStorage,
  createDoHMonitor,
});

const clearAllData = createClearAllData({
  logger: context.logger,
  clearReportQueue: () => context.cspReportingService.clearReportQueue(),
  clearReportsIfInitialized: () => context.backgroundApi.clearReportsIfInitialized(),
  ensureOffscreenDocument,
  clearAllStorage,
});

const { initializeBackgroundServices } = createBackgroundInitializers({
  context,
  extensionNetwork,
  initializeCSPReporter: () => context.cspReportingService.initializeReporter(),
  checkMigrationNeeded,
  migrateToDatabase,
});

export default defineBackground(() => {
  registerExtensionMonitorListener();
  registerDoHMonitorListener();

  initializeBackgroundServices();
  registerRecurringAlarms();

  registerAlarmListeners({
    logger: context.logger,
    flushReportQueue: () => context.cspReportingService.flushReportQueue(),
    flushNetworkRequestBuffer: extensionNetwork.flushNetworkRequestBuffer,
    checkDNRMatchesHandler: extensionNetwork.checkDNRMatchesHandler,
    analyzeExtensionRisks: extensionNetwork.analyzeExtensionRisks,
    cleanupOldData: context.backgroundConfig.cleanupOldData,
  });

  const runtimeHandlers = createRuntimeMessageHandlers(
    createRuntimeHandlerDependencies({
      context,
      extensionNetwork,
      doHMonitor: doHMonitorService,
      clearAllData,
      getSSOManager,
      getEnterpriseManager,
    })
  );

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage;
    const type = typeof message.type === "string" ? message.type : "";

    if (!type) {
      context.logger.warn("Unknown message type:", message.type);
      return false;
    }

    const directHandler = runtimeHandlers.direct.get(type);
    if (directHandler) {
      return directHandler(message, sender, sendResponse);
    }

    const asyncHandler = runtimeHandlers.async.get(type);
    if (asyncHandler) {
      return runAsyncMessageHandler(context.logger, asyncHandler, message, sender, sendResponse);
    }

    context.logger.warn("Unknown message type:", type);
    return false;
  });

  doHMonitorService.start().catch((err) => context.logger.error("Failed to start DoH monitor:", err));

  registerCookieMonitor(context);
});
