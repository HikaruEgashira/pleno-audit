export function registerRecurringAlarms(): void {
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });
  chrome.alarms.create("flushNetworkRequests", { periodInMinutes: 0.1 });
  chrome.alarms.create("checkDNRMatches", { periodInMinutes: 0.6 });
  chrome.alarms.create("extensionRiskAnalysis", { periodInMinutes: 5 });
  chrome.alarms.create("dataCleanup", { periodInMinutes: 60 * 24 });
}

export function registerAlarmHandlers(
  handlers: Map<string, () => void>
): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
      return;
    }
    const handler = handlers.get(alarm.name);
    if (handler) {
      handler();
    }
  });
}
