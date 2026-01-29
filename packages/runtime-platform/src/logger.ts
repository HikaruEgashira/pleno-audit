/**
 * Logger utility for consistent logging across the extension
 *
 * Features:
 * - Log level filtering (debug only in dev mode)
 * - Module-based prefixes
 * - Optional debugger sink for WebSocket forwarding
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const PREFIX = "[Pleno Audit]";

// Debugger sink for forwarding logs to WebSocket
let debuggerSink: ((entry: LogEntry) => void) | null = null;

/**
 * Set the debugger sink for forwarding logs
 * Called by debug-bridge when WebSocket is connected
 */
export function setDebuggerSink(
  sink: ((entry: LogEntry) => void) | null
): void {
  debuggerSink = sink;
}

/**
 * Check if debugger sink is set
 */
export function hasDebuggerSink(): boolean {
  return debuggerSink !== null;
}

function getMinLevel(): LogLevel {
  if (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).__PLENO_DEV__) {
    return "debug";
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    return "debug";
  }
  return "info";
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

/**
 * Serialize error objects for logging
 */
function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string): Logger {
  const log = (level: LogLevel, ...args: unknown[]) => {
    if (!shouldLog(level)) return;

    const formatted = [`${PREFIX}[${module}]`, ...args];

    // Console output
    switch (level) {
      case "debug":
        console.debug(...formatted);
        break;
      case "info":
        console.log(...formatted);
        break;
      case "warn":
        console.warn(...formatted);
        break;
      case "error":
        console.error(...formatted);
        break;
    }

    // Forward to debugger if connected
    if (debuggerSink) {
      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return serializeError(arg);
          }
          if (typeof arg === "object") {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(" ");

      debuggerSink({
        timestamp: Date.now(),
        level,
        module,
        message,
      });
    }
  };

  return {
    debug: (...args) => log("debug", ...args),
    info: (...args) => log("info", ...args),
    warn: (...args) => log("warn", ...args),
    error: (...args) => log("error", ...args),
  };
}
