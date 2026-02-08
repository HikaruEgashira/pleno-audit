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
  data?: unknown;
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
