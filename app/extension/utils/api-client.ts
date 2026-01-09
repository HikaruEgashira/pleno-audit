import type { CSPViolation, NetworkRequest, CSPReport } from "@service-policy-auditor/core";
import type { LocalApiResponse } from "./db-schema";

export type ConnectionMode = "local" | "remote";

export interface ApiClientConfig {
  mode: ConnectionMode;
  remoteEndpoint?: string;
}

let offscreenCreated = false;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenCreated) return;

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen/index.html",
      reasons: [chrome.offscreen.Reason.LOCAL_STORAGE],
      justification: "Running local SQL database with sql.js WASM",
    });
    offscreenCreated = true;
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("already exists"))) {
      throw error;
    }
    offscreenCreated = true;
  }
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

  async getReports(): Promise<{ reports: CSPReport[]; lastUpdated: string }> {
    return this.request("/api/v1/reports");
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

  async getViolations(): Promise<{ violations: CSPViolation[] }> {
    return this.request("/api/v1/violations");
  }

  async getNetworkRequests(): Promise<{ requests: NetworkRequest[] }> {
    return this.request("/api/v1/requests");
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
