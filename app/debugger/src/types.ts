/**
 * Message types for debug communication
 */

export interface DebugMessage {
  type: string;
  id?: string;
  data?: unknown;
}

export interface NativeResponse {
  id?: string;
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

/**
 * Log entry from extension
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}
