import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "./app.js";
import type { DatabaseAdapter, DatabaseStats, PaginatedResult } from "./db/interface.js";
import type { CSPViolation, NetworkRequest, CSPReport } from "@pleno-audit/csp";

// Mock database adapter
function createMockDb(overrides: Partial<DatabaseAdapter> = {}): DatabaseAdapter {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    insertReports: vi.fn().mockResolvedValue(undefined),
    getAllReports: vi.fn().mockResolvedValue([]),
    getAllViolations: vi.fn().mockResolvedValue([]),
    getAllNetworkRequests: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ violations: 0, requests: 0, uniqueDomains: 0 }),
    clearAll: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getReportsSince: vi.fn().mockResolvedValue([]),
    getReports: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    getViolations: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    getNetworkRequests: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    deleteOldReports: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function createViolation(overrides: Partial<CSPViolation> = {}): CSPViolation {
  return {
    type: "csp-violation",
    timestamp: new Date().toISOString(),
    pageUrl: "https://example.com/page",
    directive: "script-src",
    blockedURL: "https://evil.com/script.js",
    domain: "example.com",
    ...overrides,
  };
}

function createNetworkRequest(overrides: Partial<NetworkRequest> = {}): NetworkRequest {
  return {
    type: "network-request",
    timestamp: new Date().toISOString(),
    pageUrl: "https://example.com/page",
    url: "https://api.example.com/data",
    method: "GET",
    initiator: "fetch",
    domain: "example.com",
    ...overrides,
  };
}

describe("createApp", () => {
  it("creates an app instance", () => {
    const db = createMockDb();
    const app = createApp(db);

    expect(app).toBeDefined();
    expect(app.request).toBeInstanceOf(Function);
  });
});

describe("GET /api/v1/stats", () => {
  it("returns database stats", async () => {
    const stats: DatabaseStats = { violations: 10, requests: 20, uniqueDomains: 5 };
    const db = createMockDb({ getStats: vi.fn().mockResolvedValue(stats) });
    const app = createApp(db);

    const res = await app.request("/api/v1/stats");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(stats);
  });

  it("returns zero stats for empty database", async () => {
    const db = createMockDb();
    const app = createApp(db);

    const res = await app.request("/api/v1/stats");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.violations).toBe(0);
    expect(json.requests).toBe(0);
    expect(json.uniqueDomains).toBe(0);
  });
});

describe("GET /api/v1/violations", () => {
  it("returns all violations", async () => {
    const violations = [createViolation({ directive: "script-src" })];
    const db = createMockDb({ getAllViolations: vi.fn().mockResolvedValue(violations) });
    const app = createApp(db);

    const res = await app.request("/api/v1/violations");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.violations).toHaveLength(1);
    expect(json.violations[0].directive).toBe("script-src");
  });

  it("returns empty array for no violations", async () => {
    const db = createMockDb();
    const app = createApp(db);

    const res = await app.request("/api/v1/violations");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.violations).toHaveLength(0);
  });
});

describe("GET /api/v1/requests", () => {
  it("returns all network requests", async () => {
    const requests = [createNetworkRequest({ method: "POST" })];
    const db = createMockDb({ getAllNetworkRequests: vi.fn().mockResolvedValue(requests) });
    const app = createApp(db);

    const res = await app.request("/api/v1/requests");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.requests).toHaveLength(1);
    expect(json.requests[0].method).toBe("POST");
  });

  it("returns empty array for no requests", async () => {
    const db = createMockDb();
    const app = createApp(db);

    const res = await app.request("/api/v1/requests");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.requests).toHaveLength(0);
  });
});

describe("GET /api/v1/reports", () => {
  it("returns all reports without pagination", async () => {
    const reports = [createViolation(), createNetworkRequest()];
    const db = createMockDb({ getAllReports: vi.fn().mockResolvedValue(reports) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reports).toHaveLength(2);
    expect(json.lastUpdated).toBeDefined();
  });

  it("returns paginated reports with limit", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [createViolation()],
      total: 5,
      hasMore: true,
    };
    const db = createMockDb({ getReports: vi.fn().mockResolvedValue(paginatedResult) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports?limit=1");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reports).toHaveLength(1);
    expect(json.total).toBe(5);
    expect(json.hasMore).toBe(true);
  });

  it("returns paginated reports with offset", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [createNetworkRequest()],
      total: 5,
      hasMore: true,
    };
    const db = createMockDb({ getReports: vi.fn().mockResolvedValue(paginatedResult) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports?offset=1");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reports).toHaveLength(1);
    expect(json.total).toBe(5);
  });

  it("returns reports filtered by since", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [createViolation()],
      total: 1,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const since = "2024-01-01T00:00:00.000Z";
    const res = await app.request(`/api/v1/reports?since=${since}`);

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ since }));
  });

  it("returns reports filtered by until", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [createViolation()],
      total: 1,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const until = "2024-12-31T23:59:59.999Z";
    const res = await app.request(`/api/v1/reports?until=${until}`);

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ until }));
  });
});

describe("POST /api/v1/reports", () => {
  it("inserts reports and returns stats", async () => {
    const stats: DatabaseStats = { violations: 1, requests: 0, uniqueDomains: 1 };
    const insertReports = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertReports, getStats: vi.fn().mockResolvedValue(stats) });
    const app = createApp(db);

    const reports = [createViolation()];
    const res = await app.request("/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.totalReports).toBe(1);
    expect(insertReports).toHaveBeenCalledWith(reports);
  });

  it("handles empty reports array", async () => {
    const stats: DatabaseStats = { violations: 0, requests: 0, uniqueDomains: 0 };
    const insertReports = vi.fn();
    const db = createMockDb({ insertReports, getStats: vi.fn().mockResolvedValue(stats) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: [] }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(insertReports).not.toHaveBeenCalled();
  });

  it("handles missing reports field", async () => {
    const stats: DatabaseStats = { violations: 0, requests: 0, uniqueDomains: 0 };
    const insertReports = vi.fn();
    const db = createMockDb({ insertReports, getStats: vi.fn().mockResolvedValue(stats) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(insertReports).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/reports", () => {
  it("clears all reports", async () => {
    const clearAll = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ clearAll });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports", { method: "DELETE" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(clearAll).toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/reports/old", () => {
  it("deletes old reports", async () => {
    const deleteOldReports = vi.fn().mockResolvedValue(5);
    const db = createMockDb({ deleteOldReports });
    const app = createApp(db);

    const before = "2024-01-01T00:00:00.000Z";
    const res = await app.request(`/api/v1/reports/old?before=${before}`, { method: "DELETE" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deleted).toBe(5);
    expect(deleteOldReports).toHaveBeenCalledWith(before);
  });

  it("returns error without before parameter", async () => {
    const db = createMockDb();
    const app = createApp(db);

    const res = await app.request("/api/v1/reports/old", { method: "DELETE" });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("before");
  });
});

describe("GET /api/v1/reports/violations", () => {
  it("returns paginated violations", async () => {
    const paginatedResult: PaginatedResult<CSPViolation> = {
      data: [createViolation()],
      total: 10,
      hasMore: true,
    };
    const db = createMockDb({ getViolations: vi.fn().mockResolvedValue(paginatedResult) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports/violations?limit=1");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.violations).toHaveLength(1);
    expect(json.total).toBe(10);
    expect(json.hasMore).toBe(true);
  });
});

describe("GET /api/v1/reports/network", () => {
  it("returns paginated network requests", async () => {
    const paginatedResult: PaginatedResult<NetworkRequest> = {
      data: [createNetworkRequest()],
      total: 10,
      hasMore: true,
    };
    const db = createMockDb({ getNetworkRequests: vi.fn().mockResolvedValue(paginatedResult) });
    const app = createApp(db);

    const res = await app.request("/api/v1/reports/network?limit=1");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.requests).toHaveLength(1);
    expect(json.total).toBe(10);
    expect(json.hasMore).toBe(true);
  });
});

describe("GET /api/v1/sync", () => {
  it("returns reports since timestamp", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [createViolation()],
      total: 1,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const since = "2024-01-01T00:00:00.000Z";
    const res = await app.request(`/api/v1/sync?since=${since}`);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reports).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.hasMore).toBe(false);
    expect(json.serverTime).toBeDefined();
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ since }));
  });

  it("uses default since when not provided", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [],
      total: 0,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const res = await app.request("/api/v1/sync");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ since: "1970-01-01T00:00:00.000Z" }));
  });

  it("respects limit parameter", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [],
      total: 0,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const res = await app.request("/api/v1/sync?limit=100");

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it("uses default batch size when limit not provided", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [],
      total: 0,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const res = await app.request("/api/v1/sync");

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });
});

describe("POST /api/v1/sync", () => {
  it("receives and returns reports", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [createNetworkRequest()],
      total: 1,
      hasMore: false,
    };
    const insertReports = vi.fn().mockResolvedValue(undefined);
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ insertReports, getReports });
    const app = createApp(db);

    const clientReports = [createViolation()];
    const clientTime = "2024-01-01T00:00:00.000Z";
    const res = await app.request("/api/v1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: clientReports, clientTime }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.serverReports).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.hasMore).toBe(false);
    expect(json.serverTime).toBeDefined();
    expect(insertReports).toHaveBeenCalledWith(clientReports);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ since: clientTime }));
  });

  it("handles empty reports from client", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [],
      total: 0,
      hasMore: false,
    };
    const insertReports = vi.fn();
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ insertReports, getReports });
    const app = createApp(db);

    const res = await app.request("/api/v1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: [], clientTime: "2024-01-01T00:00:00.000Z" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(insertReports).not.toHaveBeenCalled();
  });

  it("uses default clientTime when not provided", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [],
      total: 0,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const res = await app.request("/api/v1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: [] }),
    });

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ since: "1970-01-01T00:00:00.000Z" }));
  });

  it("respects custom limit in sync", async () => {
    const paginatedResult: PaginatedResult<CSPReport> = {
      data: [],
      total: 0,
      hasMore: false,
    };
    const getReports = vi.fn().mockResolvedValue(paginatedResult);
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const res = await app.request("/api/v1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: [], clientTime: "2024-01-01T00:00:00.000Z", limit: 50 }),
    });

    expect(res.status).toBe(200);
    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });
});

describe("CORS support", () => {
  it("includes CORS headers", async () => {
    const db = createMockDb();
    const app = createApp(db);

    const res = await app.request("/api/v1/stats", {
      method: "OPTIONS",
      headers: { Origin: "https://example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
  });
});

describe("Query parsing", () => {
  it("parses numeric limit correctly", async () => {
    const getReports = vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false });
    const db = createMockDb({ getReports });
    const app = createApp(db);

    await app.request("/api/v1/reports?limit=50");

    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it("parses numeric offset correctly", async () => {
    const getReports = vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false });
    const db = createMockDb({ getReports });
    const app = createApp(db);

    await app.request("/api/v1/reports?offset=10");

    expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ offset: 10 }));
  });

  it("handles combined query parameters", async () => {
    const getReports = vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false });
    const db = createMockDb({ getReports });
    const app = createApp(db);

    const since = "2024-01-01T00:00:00.000Z";
    const until = "2024-12-31T23:59:59.999Z";
    await app.request(`/api/v1/reports?limit=10&offset=5&since=${since}&until=${until}`);

    expect(getReports).toHaveBeenCalledWith({
      limit: 10,
      offset: 5,
      since,
      until,
    });
  });
});
