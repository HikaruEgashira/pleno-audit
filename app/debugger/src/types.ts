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
