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
let initLocalServerPromise: Promise<void> | null = null;
let clearAllIndexedDBPromise: Promise<void> | null = null;

async function initLocalServer(): Promise<void> {
  if (app) return;
  if (initLocalServerPromise) {
    await initLocalServerPromise;
    return;
  }

  initLocalServerPromise = (async () => {
    // Parquetアダプターを初期化
    const nextDb = new ParquetAdapter();
    await nextDb.init();
    db = nextDb;
    app = createApp(nextDb);
  })();

  try {
    await initLocalServerPromise;
  } finally {
    initLocalServerPromise = null;
  }
}

async function waitForClearCompletion(): Promise<void> {
  if (!clearAllIndexedDBPromise) return;
  await clearAllIndexedDBPromise;
}

async function ensureLocalServerReady(): Promise<void> {
  await waitForClearCompletion();
  if (!app || !db) {
    await initLocalServer();
  }
}

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

async function handleLocalApiRequest(
  request: { method: string; path: string; body?: unknown }
): Promise<{ status: number; data: unknown }> {
  await ensureLocalServerReady();
  if (!app) throw new Error("Local server not initialized");

  const req = new Request(`http://localhost${request.path}`, {
    method: request.method,
    headers: { "Content-Type": "application/json" },
    body: request.body ? JSON.stringify(request.body) : undefined,
  });

  const response = await app.fetch(req);
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
  await ensureLocalServerReady();

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

async function closeLocalServer(): Promise<void> {
  if (!db) {
    app = null;
    return;
  }
  await db.close();
  db = null;
  app = null;
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

async function handleClearAllIndexedDB(
  message: ClearAllIndexedDBMessage
): Promise<ClearAllIndexedDBResponse> {
  try {
    if (!clearAllIndexedDBPromise) {
      clearAllIndexedDBPromise = (async () => {
        await closeLocalServer();
        await Promise.all(INDEXEDDB_NAMES.map((dbName) => deleteIndexedDatabase(dbName)));
        await initLocalServer();
      })();
    }
    await clearAllIndexedDBPromise;

    return { id: message.id, success: true };
  } catch (error) {
    return {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearAllIndexedDBPromise = null;
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
