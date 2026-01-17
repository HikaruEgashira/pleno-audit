import type { CSPViolation, NetworkRequest, CSPReport } from "@pleno-audit/csp";
import type { LocalApiResponse } from "./offscreen/db-schema.js";
import { createLogger } from "./logger.js";

const logger = createLogger("api-client");

export type ConnectionMode = "local" | "remote";

export interface QueryOptions {
  limit?: number;
  offset?: number;
  since?: string;
  until?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface ApiClientConfig {
  mode: ConnectionMode;
  remoteEndpoint?: string;
}

let offscreenReady = false;
let offscreenCreating: Promise<void> | null = null;
let offscreenReadyResolvers: (() => void)[] = [];

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "OFFSCREEN_READY") {
      offscreenReady = true;
      offscreenReadyResolvers.forEach(resolve => resolve());
      offscreenReadyResolvers = [];
    }
    return false;
  });
}

async function waitForOffscreenReady(timeout = 15000): Promise<void> {
  if (offscreenReady) return;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      logger.error("Offscreen document did not respond within timeout");
      reject(new Error("Offscreen ready timeout"));
    }, timeout);

    offscreenReadyResolvers.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function ensureOffscreenDocument(): Promise<void> {
  // 既にreadyなら即座にreturn
  if (offscreenReady) return;

  // 作成中のプロミスがあれば待機
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = (async () => {
    // 再度チェック（待機中に別の呼び出しが完了した可能性）
    if (offscreenReady) return;

    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.LOCAL_STORAGE],
        justification: "Running local SQL database with sql.js WASM",
      });
      await waitForOffscreenReady();
    } catch (error) {
      // ドキュメントが既に存在する場合は成功として扱う
      if (error instanceof Error && (
        error.message.includes("already exists") ||
        error.message.includes("Only a single offscreen document")
      )) {
        offscreenReady = true;
        return;
      }
      offscreenCreating = null;
      throw error;
    }
  })();

  return offscreenCreating;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class ApiClient {
  private mode: ConnectionMode;
  private endpoint: string | null;

  constructor(config: ApiClientConfig) {
    this.mode = config.mode;
    this.endpoint = config.remoteEndpoint || null;
  }

  async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    if (this.mode === "remote" && this.endpoint) {
      return this.remoteRequest(path, options);
    }
    return this.localRequest(path, options);
  }

  private async remoteRequest<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
    const response = await fetch(`${this.endpoint}${path}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Remote request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async localRequest<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
    await ensureOffscreenDocument();

    return new Promise((resolve, reject) => {
      const id = generateId();

      chrome.runtime.sendMessage(
        {
          type: "LOCAL_API_REQUEST",
          id,
          request: {
            method: options.method || "GET",
            path,
            body: options.body,
          },
        },
        (response: LocalApiResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.data as T);
        }
      );
    });
  }

  setMode(mode: ConnectionMode, endpoint?: string): void {
    this.mode = mode;
    this.endpoint = endpoint || null;
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  getEndpoint(): string | null {
    return this.endpoint;
  }

  private buildQueryString(options?: QueryOptions): string {
    if (!options) return "";
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.offset !== undefined) params.set("offset", String(options.offset));
    if (options.since) params.set("since", options.since);
    if (options.until) params.set("until", options.until);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async getReports(options?: QueryOptions): Promise<{ reports: CSPReport[]; total?: number; hasMore?: boolean; lastUpdated: string }> {
    const qs = this.buildQueryString(options);
    return this.request(`/api/v1/reports${qs}`);
  }

  async postReports(reports: CSPReport[]): Promise<{ success: boolean; totalReports: number }> {
    return this.request("/api/v1/reports", {
      method: "POST",
      body: { reports },
    });
  }

  async clearReports(): Promise<{ success: boolean }> {
    return this.request("/api/v1/reports", { method: "DELETE" });
  }

  async getStats(): Promise<{ violations: number; requests: number; uniqueDomains: number }> {
    return this.request("/api/v1/stats");
  }

  async getViolations(options?: QueryOptions): Promise<{ violations: CSPViolation[]; total?: number; hasMore?: boolean }> {
    const qs = this.buildQueryString(options);
    return this.request(`/api/v1/reports/violations${qs}`);
  }

  async getNetworkRequests(options?: QueryOptions): Promise<{ requests: NetworkRequest[]; total?: number; hasMore?: boolean }> {
    const qs = this.buildQueryString(options);
    return this.request(`/api/v1/reports/network${qs}`);
  }

  async sync(since?: string): Promise<{ reports: CSPReport[]; serverTime: string }> {
    const path = since ? `/api/v1/sync?since=${encodeURIComponent(since)}` : "/api/v1/sync";
    return this.request(path);
  }

  async pushAndPull(
    reports: CSPReport[],
    clientTime: string
  ): Promise<{ serverReports: CSPReport[]; serverTime: string }> {
    return this.request("/api/v1/sync", {
      method: "POST",
      body: { reports, clientTime },
    });
  }

  async deleteOldReports(beforeTimestamp: string): Promise<number> {
    const result = await this.request<{ deleted: number }>(`/api/v1/reports/old?before=${encodeURIComponent(beforeTimestamp)}`, {
      method: "DELETE",
    });
    return result.deleted;
  }
}

let apiClientInstance: ApiClient | null = null;

export async function getApiClient(): Promise<ApiClient> {
  if (apiClientInstance) return apiClientInstance;

  const config = await chrome.storage.local.get(["connectionMode", "remoteEndpoint"]);
  apiClientInstance = new ApiClient({
    mode: (config.connectionMode as ConnectionMode) || "local",
    remoteEndpoint: config.remoteEndpoint,
  });

  return apiClientInstance;
}

export async function updateApiClientConfig(mode: ConnectionMode, endpoint?: string): Promise<void> {
  await chrome.storage.local.set({
    connectionMode: mode,
    remoteEndpoint: endpoint || null,
  });

  if (apiClientInstance) {
    apiClientInstance.setMode(mode, endpoint);
  }
}
