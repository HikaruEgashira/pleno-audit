#!/usr/bin/env node
/**
 * Debug Server - WebSocket server for CLI-Extension communication
 *
 * The extension connects to this server when running in dev mode.
 * CLI commands send requests through this server to the extension.
 */
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "node:events";
import { execSync } from "node:child_process";
import { createConnection } from "node:net";

const DEBUG_PORT = parseInt(process.env.DEBUG_PORT || "9222", 10);

/**
 * Check if a port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Kill process using the specified port
 */
export async function killPortProcess(port: number): Promise<boolean> {
  const inUse = await isPortInUse(port);
  if (!inUse) {
    return false;
  }

  console.log(`[server] Port ${port} is in use, killing existing process...`);

  try {
    // macOS/Linux: use lsof to find PID
    const pid = execSync(`lsof -i :${port} -t 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();

    if (pid) {
      const pids = pid.split("\n").filter(Boolean);
      for (const p of pids) {
        try {
          execSync(`kill -9 ${p} 2>/dev/null`);
          console.log(`[server] Killed process ${p}`);
        } catch {
          // Process may have already exited
        }
      }
      // Wait for port to be released
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }
  } catch {
    // lsof not available or no process found
  }

  return false;
}

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

interface ExtensionConnection {
  socket: WebSocket;
  extensionId: string;
  version: string;
  devMode: boolean;
  context?: string;
  connectedAt: number;
}

class DebugServer extends EventEmitter {
  private wss: WebSocketServer;
  private extensionConnections: Map<string, ExtensionConnection> = new Map();
  private activeExtensionId: string | null = null;
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
    let connectionId: string | null = null;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle initial connection message with extension info
        if (message.data?.type === "connected" && message.data?.extensionId) {
          const extId: string = message.data.extensionId;
          connectionId = extId;
          const connInfo: ExtensionConnection = {
            socket: ws,
            extensionId: extId,
            version: message.data.version || "unknown",
            devMode: message.data.devMode || false,
            context: message.data.context,
            connectedAt: Date.now(),
          };

          // Check if this extension is already connected
          const existing = this.extensionConnections.get(extId);
          if (existing) {
            console.log(`[server] Extension ${extId} reconnected, closing old connection`);
            existing.socket.close();
          }

          this.extensionConnections.set(extId, connInfo);

          // Always use the most recent connection as active
          this.activeExtensionId = connectionId;
          console.log(`[server] Extension connected: ${connectionId} (${connInfo.context || "background"})`);
          console.log(`[server] Active connections: ${this.extensionConnections.size}`);

          this.emit("extension-connected", connInfo);
          return;
        }

        // Handle DEBUG_LOG messages - broadcast to CLI clients
        if (message.type === "DEBUG_LOG") {
          this.broadcastToCLI(message);
          this.emit("log", message.data);
          return;
        }

        // Handle regular responses
        this.handleResponse(message as DebugResponse);
      } catch (error) {
        console.error("[server] Invalid message:", error);
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`[server] Extension disconnected (code: ${code}, reason: ${reason?.toString() || "none"})`);

      if (connectionId) {
        this.extensionConnections.delete(connectionId);

        // If the active extension disconnected, switch to another if available
        if (this.activeExtensionId === connectionId) {
          const remaining = Array.from(this.extensionConnections.keys());
          this.activeExtensionId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
          if (this.activeExtensionId) {
            console.log(`[server] Switched to extension: ${this.activeExtensionId}`);
          }
        }
      }

      if (this.extensionConnections.size === 0) {
        this.emit("extension-disconnected");
        // Reject all pending requests
        for (const [, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Extension disconnected"));
        }
        this.pendingRequests.clear();
      }
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
   * Broadcast a message to all connected CLI clients
   */
  private broadcastToCLI(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.cliSockets) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Get the active extension socket
   */
  private getActiveSocket(): WebSocket | null {
    if (!this.activeExtensionId) return null;
    const conn = this.extensionConnections.get(this.activeExtensionId);
    if (!conn || conn.socket.readyState !== WebSocket.OPEN) return null;
    return conn.socket;
  }

  /**
   * Send a message to the extension and wait for response
   */
  async send(type: string, data?: unknown, timeoutMs = 10000): Promise<DebugResponse> {
    const socket = this.getActiveSocket();
    if (!socket) {
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
      socket.send(JSON.stringify(message));
    });
  }

  /**
   * Check if extension is connected
   */
  isExtensionConnected(): boolean {
    return this.getActiveSocket() !== null;
  }

  /**
   * Get active extension info
   */
  getActiveExtension(): ExtensionConnection | null {
    if (!this.activeExtensionId) return null;
    return this.extensionConnections.get(this.activeExtensionId) || null;
  }

  /**
   * Get all connected extensions
   */
  getConnections(): ExtensionConnection[] {
    return Array.from(this.extensionConnections.values());
  }

  /**
   * Set active extension by ID
   */
  setActiveExtension(extensionId: string): boolean {
    if (this.extensionConnections.has(extensionId)) {
      this.activeExtensionId = extensionId;
      console.log(`[server] Active extension set to: ${extensionId}`);
      return true;
    }
    return false;
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
