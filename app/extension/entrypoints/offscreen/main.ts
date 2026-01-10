import initSqlJs from "sql.js";
import { createApp, SqlJsAdapter } from "@service-policy-auditor/api";
import {
  isLocalApiRequest,
  type DBMessage,
  type LocalApiResponse,
  type LegacyDBMessage,
  type LegacyDBResponse,
} from "../../utils/db-schema";
import { IndexedDBStorage } from "../../utils/indexeddb-storage";

let app: ReturnType<typeof createApp> | null = null;
let db: SqlJsAdapter | null = null;
let indexedDBStorage: IndexedDBStorage | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function initLocalServer(): Promise<void> {
  if (app) return;

  // Initialize IndexedDB storage
  indexedDBStorage = new IndexedDBStorage();
  await indexedDBStorage.init();

  // Load saved database if exists
  const savedData = await indexedDBStorage.load();

  const SQL = await initSqlJs({
    locateFile: () => chrome.runtime.getURL("sql-wasm.wasm"),
  });

  db = new SqlJsAdapter(SQL, {
    loadFromBuffer: savedData || undefined,
    onSave: (data: Uint8Array) => {
      // Debounce saves to avoid too frequent writes
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
      }
      saveDebounceTimer = setTimeout(() => {
        indexedDBStorage?.save(data).catch(console.error);
      }, 1000);
    },
  });
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
        if (indexedDBStorage) {
          await indexedDBStorage.clear();
        }
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

// Only handle messages intended for offscreen document
const OFFSCREEN_MESSAGE_TYPES = new Set([
  "LOCAL_API_REQUEST",
  "init",
  "insert",
  "query",
  "clear",
  "export",
  "stats",
]);

chrome.runtime.onMessage.addListener(
  (message: DBMessage, _sender, sendResponse) => {
    // Only process messages intended for offscreen
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
    // Notify background that offscreen is ready
    chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
  })
  .catch(console.error);
