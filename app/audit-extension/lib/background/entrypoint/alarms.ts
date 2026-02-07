import type { Logger } from "@pleno-audit/extension-runtime";
import { createAlarmHandlers } from "../alarm-handlers";

interface AlarmRegistrationParams {
  logger: Logger;
  flushReportQueue: () => Promise<void> | void;
  flushNetworkRequestBuffer: () => Promise<void> | void;
  checkDNRMatchesHandler: () => Promise<void> | void;
  analyzeExtensionRisks: () => Promise<void> | void;
  cleanupOldData: () => Promise<void> | void;
}

export function registerRecurringAlarms(): void {
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
  chrome.alarms.create("flushNetworkRequests", { periodInMinutes: 0.1 });
  chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
  chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
  chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });
}

export function registerAlarmListeners(params: AlarmRegistrationParams): void {
  const alarmHandlers = createAlarmHandlers({
    logger: params.logger,
    flushReportQueue: params.flushReportQueue,
    flushNetworkRequestBuffer: params.flushNetworkRequestBuffer,
    checkDNRMatchesHandler: params.checkDNRMatchesHandler,
    analyzeExtensionRisks: params.analyzeExtensionRisks,
    cleanupOldData: params.cleanupOldData,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
      return;
    }
    const handler = alarmHandlers.get(alarm.name);
    if (handler) {
      handler();
    }
  });
}
