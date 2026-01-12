#!/usr/bin/env node
/**
 * Debug Server - WebSocket server for CLI-Extension communication
 *
 * The extension connects to this server when running in dev mode.
 * CLI commands send requests through this server to the extension.
 */
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "node:events";

const DEBUG_PORT = 9222;

interface DebugMessage {
  type: string;
  id?: string;
  data?: unknown;
}

interface DebugResponse {
  id?: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (response: DebugResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

class DebugServer extends EventEmitter {
  private wss: WebSocketServer;
  private extensionSocket: WebSocket | null = null;
  private cliSockets: Set<WebSocket> = new Set();
  private pendingRequests = new Map<string, PendingRequest>();
  private messageId = 0;

  constructor(port: number = DEBUG_PORT) {
    super();

    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (ws, req) => {
      const path = req.url;
      console.log(`[server] Client connected: ${path}`);

      if (path === "/debug") {
        // Extension connects here
        this.handleExtensionConnection(ws);
      } else if (path === "/cli") {
        // CLI connects here
        this.handleCLIConnection(ws);
      } else {
        ws.close(4000, "Unknown path");
      }
    });

    this.wss.on("listening", () => {
      console.log(`[server] Debug server listening on ws://localhost:${port}/debug`);
    });

    this.wss.on("error", (error) => {
      console.error("[server] Server error:", error);
    });
  }

  private handleExtensionConnection(ws: WebSocket): void {
    if (this.extensionSocket) {
      console.log("[server] Closing previous extension connection");
      this.extensionSocket.close();
    }

    this.extensionSocket = ws;
    this.emit("extension-connected");

    ws.on("message", (data) => {
      try {
        const response: DebugResponse = JSON.parse(data.toString());
        this.handleResponse(response);
      } catch (error) {
        console.error("[server] Invalid message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[server] Extension disconnected");
      if (this.extensionSocket === ws) {
        this.extensionSocket = null;
      }
      this.emit("extension-disconnected");

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Extension disconnected"));
      }
      this.pendingRequests.clear();
    });

    ws.on("error", (error) => {
      console.error("[server] Extension socket error:", error);
    });
  }

  private handleCLIConnection(ws: WebSocket): void {
    this.cliSockets.add(ws);
    console.log("[server] CLI client connected");

    ws.on("message", async (data) => {
      try {
        const message: DebugMessage = JSON.parse(data.toString());

        // Forward to extension and wait for response
        try {
          const response = await this.send(message.type, message.data);
          // Important: spread response first, then override id with CLI's id
          const cliResponse = { ...response, id: message.id };
          ws.send(JSON.stringify(cliResponse));
        } catch (error) {
          ws.send(
            JSON.stringify({
              id: message.id,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            })
          );
        }
      } catch (error) {
        console.error("[server] Invalid CLI message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[server] CLI client disconnected");
      this.cliSockets.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("[server] CLI socket error:", error);
    });
  }

  private handleResponse(response: DebugResponse): void {
    if (response.id && this.pendingRequests.has(response.id)) {
      const pending = this.pendingRequests.get(response.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);
      pending.resolve(response);
    } else {
      // Broadcast message
      this.emit("message", response);
    }
  }

  /**
   * Send a message to the extension and wait for response
   */
  async send(type: string, data?: unknown, timeoutMs = 10000): Promise<DebugResponse> {
    if (!this.extensionSocket || this.extensionSocket.readyState !== WebSocket.OPEN) {
      throw new Error("Extension not connected");
    }

    const id = `${++this.messageId}`;
    const message: DebugMessage = { type, id, data };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.extensionSocket!.send(JSON.stringify(message));
    });
  }

  /**
   * Check if extension is connected
   */
  isExtensionConnected(): boolean {
    return (
      this.extensionSocket !== null &&
      this.extensionSocket.readyState === WebSocket.OPEN
    );
  }

  /**
   * Close the server
   */
  close(): void {
    this.wss.close();
  }
}

// Singleton instance
let serverInstance: DebugServer | null = null;

/**
 * Get or create server instance
 */
export function getDebugServer(): DebugServer {
  if (!serverInstance) {
    serverInstance = new DebugServer(DEBUG_PORT);
  }
  return serverInstance;
}

/**
 * Wait for extension to connect
 */
export async function waitForExtension(timeoutMs = 30000): Promise<void> {
  const server = getDebugServer();

  if (server.isExtensionConnected()) {
    return;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Extension did not connect within ${timeoutMs / 1000}s. Is the extension running in dev mode?`
        )
      );
    }, timeoutMs);

    server.once("extension-connected", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

// CLI entry point - run server standalone
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  console.log("Starting debug server...");
  const server = getDebugServer();

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.close();
    process.exit(0);
  });

  // Log connection events
  server.on("extension-connected", () => {
    console.log("[server] Extension connected and ready");
  });

  server.on("extension-disconnected", () => {
    console.log("[server] Waiting for extension to reconnect...");
  });
}

export { DebugServer };
