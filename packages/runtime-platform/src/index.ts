// Logger
export {
  createLogger,
  setDebuggerSink,
  hasDebuggerSink,
  type Logger,
  type LogLevel,
  type LogEntry,
} from "./logger.js";

// Message Handler
export { createMessageRouter, fireAndForget } from "./message-handler.js";

// Browser Adapter
export {
  createBrowserAdapter,
  browserAdapter,
  getBrowserAPI,
  isFirefox,
  isChrome,
  isExtensionContext,
  hasSessionStorage,
  hasManagedStorage,
  hasIdentityAPI,
  isManifestV3,
  getSessionStorage,
  setSessionStorage,
  removeSessionStorage,
} from "./browser-adapter.js";
