/**
 * Extension client for CLI usage
 *
 * Connects to the debug server as a WebSocket client.
 * The server must be running separately (via `pleno-debug server`).
 */
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { NativeResponse } from "./types.js";

const DEBUG_PORT = process.env.DEBUG_PORT || "9222";
const DEBUG_SERVER_URL = `ws://localhost:${DEBUG_PORT}/cli`;
const CONNECT_TIMEOUT = 5000;
const RESPONSE_TIMEOUT = 10000;

interface PendingRequest {
  resolve: (response: NativeResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class ExtensionClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private messageId = 0;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Connection timeout. Is the debug server running? Start it with: pleno-debug server`
          )
        );
      }, CONNECT_TIMEOUT);

      try {
        this.ws = new WebSocket(DEBUG_SERVER_URL);

        this.ws.on("open", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws.on("error", (error) => {
          clearTimeout(timeout);
          reject(
            new Error(
              `Failed to connect to debug server: ${error.message}\nStart the server with: pleno-debug server`
            )
          );
        });

        this.ws.on("close", () => {
          this.ws = null;
          this.emit("disconnect");
        });

        this.ws.on("message", (data) => {
          try {
            const response: NativeResponse = JSON.parse(data.toString());
            this.handleResponse(response);
          } catch {
            // Ignore parse errors
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private handleResponse(response: NativeResponse): void {
    if (response.id && this.pendingRequests.has(response.id)) {
      const pending = this.pendingRequests.get(response.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);
      pending.resolve(response);
    } else {
      // Broadcast message - emit as event based on type
      const data = response.data as { type?: string };
      if (data?.type) {
        this.emit(data.type, data);
      }
      this.emit("message", response);
    }
  }

  async send(type: string, data?: unknown): Promise<NativeResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to debug server");
    }

    const id = `${++this.messageId}`;
    const message = { type, id, data };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, RESPONSE_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify(message));
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Disconnected"));
    }
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

let clientInstance: ExtensionClient | null = null;

/**
 * Get or create extension client instance
 */
export async function getExtensionClient(): Promise<ExtensionClient> {
  if (clientInstance && clientInstance.isConnected()) {
    return clientInstance;
  }

  clientInstance = new ExtensionClient();
  await clientInstance.connect();
  return clientInstance;
}
