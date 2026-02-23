import { createApp, ParquetAdapter } from "@pleno-audit/api";
import {
  isLocalApiRequest,
  type DBMessage,
  type LocalApiResponse,
  type LegacyDBMessage,
  type LegacyDBResponse,
  type ClearAllIndexedDBMessage,
  type ClearAllIndexedDBResponse,
} from "@pleno-audit/extension-runtime/offscreen";
import { initDebugWebSocket } from "./debug-websocket.js";

// IndexedDB database names
const INDEXEDDB_NAMES = ["PlenoAuditDB", "PlenoAuditParquet", "PlenoAuditEvents"];

// --- OffscreenLifecycle ---

type OffscreenPhase = "idle" | "initializing" | "ready" | "clearing";

class OffscreenLifecycle {
  private phase: OffscreenPhase = "idle";
  private transitionPromise: Promise<void> | null = null;
  app: ReturnType<typeof createApp> | null = null;
  db: ParquetAdapter | null = null;

  async initialize(factory: () => Promise<{ app: ReturnType<typeof createApp>; db: ParquetAdapter }>): Promise<void> {
    if (this.phase === "ready") return;

    if (this.phase === "clearing") {
      // clear完了を待ってから初期化
      await this.transitionPromise;
    }

    if (this.phase === "initializing" && this.transitionPromise) {
      await this.transitionPromise;
      return;
    }

    this.phase = "initializing";
    this.transitionPromise = (async () => {
      const result = await factory();
      this.app = result.app;
      this.db = result.db;
      this.phase = "ready";
    })();

    try {
      await this.transitionPromise;
    } catch (error) {
      this.phase = "idle";
      throw error;
    } finally {
      this.transitionPromise = null;
    }
  }

  async clear(
    teardown: () => Promise<void>,
    reinit: () => Promise<{ app: ReturnType<typeof createApp>; db: ParquetAdapter }>
  ): Promise<void> {
    if (this.phase === "clearing" && this.transitionPromise) {
      // 既にclear中なら同じPromiseを待つ
      await this.transitionPromise;
      return;
    }

    this.phase = "clearing";
    this.transitionPromise = (async () => {
      await teardown();
      this.app = null;
      this.db = null;
      const result = await reinit();
      this.app = result.app;
      this.db = result.db;
      this.phase = "ready";
    })();

    try {
      await this.transitionPromise;
    } catch (error) {
      this.phase = "idle";
      this.app = null;
      this.db = null;
      throw error;
    } finally {
      this.transitionPromise = null;
    }
  }

  async ensureReady(factory: () => Promise<{ app: ReturnType<typeof createApp>; db: ParquetAdapter }>): Promise<void> {
    if (this.phase === "clearing" && this.transitionPromise) {
      await this.transitionPromise;
      return;
    }
    if (this.phase !== "ready") {
      await this.initialize(factory);
    }
  }

  get isReady(): boolean {
    return this.phase === "ready";
  }
}

const lifecycle = new OffscreenLifecycle();

// --- Factory / Teardown ---

async function createLocalServer(): Promise<{ app: ReturnType<typeof createApp>; db: ParquetAdapter }> {
  const db = new ParquetAdapter();
  await db.init();
  const app = createApp(db);
  return { app, db };
}

async function closeLocalServer(): Promise<void> {
  if (!lifecycle.db) {
    lifecycle.app = null;
    return;
  }
  try {
    await lifecycle.db.close();
  } finally {
    lifecycle.db = null;
    lifecycle.app = null;
  }
}

async function deleteIndexedDatabase(dbName: string): Promise<void> {
  const BLOCKED_TIMEOUT_MS = 10_000;
  await new Promise<void>((resolve, reject) => {
    let blockedTimer: ReturnType<typeof setTimeout> | null = null;
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => {
      if (blockedTimer) clearTimeout(blockedTimer);
      resolve();
    };
    request.onerror = () => {
      if (blockedTimer) clearTimeout(blockedTimer);
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn(`[offscreen] IndexedDB delete is blocked: ${dbName}`);
      blockedTimer = setTimeout(() => {
        reject(new Error(`IndexedDB delete blocked timeout: ${dbName}`));
      }, BLOCKED_TIMEOUT_MS);
    };
  });
}

// --- Helpers ---

function parseResponseBody(bodyText: string): unknown {
  if (bodyText.length === 0) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return fallback;
}

// --- Message Handlers ---

async function handleLocalApiRequest(
  request: { method: string; path: string; body?: unknown }
): Promise<{ status: number; data: unknown }> {
  await lifecycle.ensureReady(createLocalServer);
  if (!lifecycle.app) throw new Error("Local server not initialized");

  const req = new Request(`http://localhost${request.path}`, {
    method: request.method,
    headers: { "Content-Type": "application/json" },
    body: request.body ? JSON.stringify(request.body) : undefined,
  });

  const response = await lifecycle.app.fetch(req);
  const bodyText = await response.text();
  const data = parseResponseBody(bodyText);

  if (!response.ok) {
    const message = extractErrorMessage(data, response.statusText);
    throw new Error(`Local API request failed: ${response.status} ${message}`);
  }

  return { status: response.status, data };
}

async function handleLegacyMessage(
  message: LegacyDBMessage
): Promise<LegacyDBResponse> {
  await lifecycle.ensureReady(createLocalServer);

  try {
    switch (message.type) {
      case "init":
        await lifecycle.initialize(createLocalServer);
        return { id: message.id, success: true };

      case "insert":
        if (!lifecycle.db) throw new Error("Database not initialized");
        if (message.table === "csp_violations" && message.data) {
          const reports = message.data.map((item) => {
            const v = item as Record<string, unknown>;
            return {
              type: "csp-violation" as const,
              timestamp: v.timestamp as string,
              pageUrl: v.pageUrl as string,
              directive: v.directive as string,
              blockedURL: v.blockedUrl as string,
              domain: v.domain as string,
              disposition: v.disposition as "enforce" | "report",
              originalPolicy: v.originalPolicy as string | undefined,
              sourceFile: v.sourceFile as string | undefined,
              lineNumber: v.lineNumber as number | undefined,
              columnNumber: v.columnNumber as number | undefined,
              statusCode: v.statusCode as number | undefined,
            };
          });
          await lifecycle.db.insertReports(reports);
        } else if (message.table === "network_requests" && message.data) {
          const reports = message.data.map((item) => {
            const r = item as Record<string, unknown>;
            return {
              type: "network-request" as const,
              timestamp: r.timestamp as string,
              pageUrl: r.pageUrl as string,
              url: r.url as string,
              method: r.method as string,
              initiator: r.initiator as "fetch" | "xhr" | "websocket" | "beacon" | "script" | "img" | "style" | "frame" | "font" | "media",
              domain: r.domain as string,
              resourceType: r.resourceType as string | undefined,
            };
          });
          await lifecycle.db.insertReports(reports);
        }
        return { id: message.id, success: true };

      case "query":
        if (!lifecycle.db) throw new Error("Database not initialized");
        const violations = await lifecycle.db.getAllViolations();
        const requests = await lifecycle.db.getAllNetworkRequests();
        return { id: message.id, success: true, data: [...violations, ...requests] };

      case "clear":
        if (!lifecycle.db) throw new Error("Database not initialized");
        await lifecycle.db.clearAll();
        return { id: message.id, success: true };

      case "stats":
        if (!lifecycle.db) throw new Error("Database not initialized");
        const stats = await lifecycle.db.getStats();
        return { id: message.id, success: true, data: stats };

      default:
        return {
          id: message.id,
          success: false,
          error: `Unknown message type: ${message.type}`,
        };
    }
  } catch (error) {
    return {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleClearAllIndexedDB(
  message: ClearAllIndexedDBMessage
): Promise<ClearAllIndexedDBResponse> {
  try {
    await lifecycle.clear(
      async () => {
        await closeLocalServer();
        await Promise.all(INDEXEDDB_NAMES.map((dbName) => deleteIndexedDatabase(dbName)));
      },
      createLocalServer
    );

    return { id: message.id, success: true };
  } catch (error) {
    return {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// --- Message Listener ---

const OFFSCREEN_MESSAGE_TYPES = new Set([
  "LOCAL_API_REQUEST",
  "CLEAR_ALL_INDEXEDDB",
  "init",
  "insert",
  "query",
  "clear",
  "export",
  "stats",
]);

chrome.runtime.onMessage.addListener(
  (message: DBMessage, _sender, sendResponse) => {
    if (!message.type || !OFFSCREEN_MESSAGE_TYPES.has(message.type)) {
      return false;
    }

    if (isLocalApiRequest(message)) {
      handleLocalApiRequest(message.request)
        .then((result) => {
          const response: LocalApiResponse = {
            id: message.id,
            status: result.status,
            data: result.data,
          };
          sendResponse(response);
        })
        .catch((error) => {
          const response: LocalApiResponse = {
            id: message.id,
            status: 500,
            error: error instanceof Error ? error.message : String(error),
          };
          sendResponse(response);
        });
    } else if (message.type === "CLEAR_ALL_INDEXEDDB") {
      handleClearAllIndexedDB(message as ClearAllIndexedDBMessage)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            id: message.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } else {
      handleLegacyMessage(message)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            id: message.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    return true;
  }
);

// --- Bootstrap ---

lifecycle.initialize(createLocalServer)
  .then(() => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch((error) => {
      console.warn("[offscreen] Failed to notify OFFSCREEN_READY.", error);
    });
  })
  .catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[offscreen] Local server initialization failed.", error);
    chrome.runtime
      .sendMessage({ type: "OFFSCREEN_INIT_FAILED", error: reason })
      .catch((notifyError) => {
        console.warn("[offscreen] Failed to notify OFFSCREEN_INIT_FAILED.", notifyError);
      });
  });

if (import.meta.env.DEV) {
  initDebugWebSocket();
}
