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

let app: ReturnType<typeof createApp> | null = null;
let db: ParquetAdapter | null = null;

async function initLocalServer(): Promise<void> {
  if (app) return;

  // Parquetアダプターを初期化
  db = new ParquetAdapter();
  await db.init();
  app = createApp(db);
}

async function handleLocalApiRequest(
  request: { method: string; path: string; body?: unknown }
): Promise<{ status: number; data: unknown }> {
  if (!app) {
    throw new Error("Local server not initialized");
  }

  const req = new Request(`http://localhost${request.path}`, {
    method: request.method,
    headers: { "Content-Type": "application/json" },
    body: request.body ? JSON.stringify(request.body) : undefined,
  });

  const response = await app.fetch(req);
  const data = await response.json();

  return { status: response.status, data };
}

async function handleLegacyMessage(
  message: LegacyDBMessage
): Promise<LegacyDBResponse> {
  if (!db) {
    await initLocalServer();
  }

  try {
    switch (message.type) {
      case "init":
        await initLocalServer();
        return { id: message.id, success: true };

      case "insert":
        if (!db) throw new Error("Database not initialized");
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
          await db.insertReports(reports);
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
          await db.insertReports(reports);
        }
        return { id: message.id, success: true };

      case "query":
        if (!db) throw new Error("Database not initialized");
        const violations = await db.getAllViolations();
        const requests = await db.getAllNetworkRequests();
        return { id: message.id, success: true, data: [...violations, ...requests] };

      case "clear":
        if (!db) throw new Error("Database not initialized");
        await db.clearAll();
        return { id: message.id, success: true };

      case "stats":
        if (!db) throw new Error("Database not initialized");
        const stats = await db.getStats();
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
    // Close existing database connections
    if (db) {
      await db.close();
      db = null;
      app = null;
    }

    // Delete all IndexedDB databases
    const deletePromises = INDEXEDDB_NAMES.map((dbName) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          // Database is blocked, but we'll consider it a success
          // It will be deleted when connections close
          resolve();
        };
      });
    });

    await Promise.all(deletePromises);

    return { id: message.id, success: true };
  } catch (error) {
    return {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

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

initLocalServer()
  .then(() => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
  })
  .catch(() => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
  });

if (import.meta.env.DEV) {
  initDebugWebSocket();
}
