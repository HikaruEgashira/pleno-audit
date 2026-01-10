// Storage
export type { StorageData } from "./storage-types.js";
export {
  queueStorageOperation,
  getStorage,
  setStorage,
  getStorageKey,
  getServiceCount,
  clearCSPReports,
  clearAIPrompts,
} from "./storage.js";

// API Client
export {
  ApiClient,
  getApiClient,
  updateApiClientConfig,
  type ConnectionMode,
  type ApiClientConfig,
} from "./api-client.js";

// Sync Manager
export { SyncManager, getSyncManager } from "./sync-manager.js";

// Migration
export { checkMigrationNeeded, migrateToDatabase } from "./migration.js";

// Cookie Monitor
export {
  startCookieMonitor,
  onCookieChange,
  type CookieChangeCallback,
} from "./cookie-monitor.js";

// Message Handler
export { createMessageRouter, fireAndForget } from "./message-handler.js";

// Browser Adapter
export { createBrowserAdapter, browserAdapter } from "./browser-adapter.js";

// Re-export types from storage-types
export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
} from "./storage-types.js";
