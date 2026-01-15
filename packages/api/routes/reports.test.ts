import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReportsRoutes } from "./reports.js";
import type { DatabaseAdapter, PaginatedResult, DatabaseStats } from "../db/interface.js";
import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";

function createMockAdapter(): DatabaseAdapter {
  const reports: CSPReport[] = [
    {
      id: "r1",
      domain: "example.com",
      timestamp: "2024-01-01T00:00:00.000Z",
      violations: [],
      requests: [],
    },
    {
      id: "r2",
      domain: "test.com",
      timestamp: "2024-01-02T00:00:00.000Z",
      violations: [],
      requests: [],
    },
  ];

  const violations: CSPViolation[] = [
    {
      domain: "example.com",
      directive: "script-src",
      blockedURL: "https://evil.com/script.js",
      timestamp: "2024-01-01T00:00:00.000Z",
    },
    {
      domain: "test.com",
      directive: "style-src",
      blockedURL: "https://bad.com/style.css",
      timestamp: "2024-01-02T00:00:00.000Z",
    },
  ];

  const networkRequests: NetworkRequest[] = [
    {
      url: "https://api.example.com/data",
      domain: "example.com",
      method: "GET",
      timestamp: "2024-01-01T00:00:00.000Z",
    },
    {
      url: "https://cdn.test.com/resource",
      domain: "test.com",
      method: "POST",
      timestamp: "2024-01-02T00:00:00.000Z",
    },
  ];

  return {
    init: vi.fn().mockResolvedValue(undefined),
    insertReports: vi.fn().mockResolvedValue(undefined),
    getAllReports: vi.fn().mockResolvedValue(reports),
    getAllViolations: vi.fn().mockResolvedValue(violations),
    getAllNetworkRequests: vi.fn().mockResolvedValue(networkRequests),
    getReportsSince: vi.fn().mockImplementation(async (timestamp: string) => {
      return reports.filter((r) => r.timestamp >= timestamp);
    }),
    getReports: vi.fn().mockImplementation(async (options) => {
      let filtered = [...reports];
      if (options?.since) {
        filtered = filtered.filter((r) => r.timestamp >= options.since!);
      }
      if (options?.until) {
        filtered = filtered.filter((r) => r.timestamp <= options.until!);
      }
      const offset = options?.offset || 0;
      const limit = options?.limit ?? filtered.length;
      const sliced = limit === -1 ? filtered.slice(offset) : filtered.slice(offset, offset + limit);
      return {
        data: sliced,
        total: filtered.length,
        hasMore: limit !== -1 && offset + limit < filtered.length,
      } as PaginatedResult<CSPReport>;
    }),
    getViolations: vi.fn().mockImplementation(async (options) => {
      let filtered = [...violations];
      if (options?.since) {
        filtered = filtered.filter((v) => v.timestamp >= options.since!);
      }
      const offset = options?.offset || 0;
      const limit = options?.limit ?? filtered.length;
      const sliced = limit === -1 ? filtered.slice(offset) : filtered.slice(offset, offset + limit);
      return {
        data: sliced,
        total: filtered.length,
        hasMore: limit !== -1 && offset + limit < filtered.length,
      } as PaginatedResult<CSPViolation>;
    }),
    getNetworkRequests: vi.fn().mockImplementation(async (options) => {
      let filtered = [...networkRequests];
      if (options?.since) {
        filtered = filtered.filter((r) => r.timestamp >= options.since!);
      }
      const offset = options?.offset || 0;
      const limit = options?.limit ?? filtered.length;
      const sliced = limit === -1 ? filtered.slice(offset) : filtered.slice(offset, offset + limit);
      return {
        data: sliced,
        total: filtered.length,
        hasMore: limit !== -1 && offset + limit < filtered.length,
      } as PaginatedResult<NetworkRequest>;
    }),
    getStats: vi.fn().mockResolvedValue({
      violations: 2,
      requests: 2,
      events: 0,
      uniqueDomains: 2,
    } as DatabaseStats),
    deleteOldReports: vi.fn().mockResolvedValue(1),
    clearAll: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createReportsRoutes", () => {
  let mockAdapter: DatabaseAdapter;
  let app: ReturnType<typeof createReportsRoutes>;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    app = createReportsRoutes(mockAdapter);
  });

  describe("GET /", () => {
    it("returns all reports without query params", async () => {
      const res = await app.request("/");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.reports).toHaveLength(2);
      expect(json.lastUpdated).toBeDefined();
      expect(mockAdapter.getAllReports).toHaveBeenCalled();
    });

    it("returns paginated reports with limit", async () => {
      const res = await app.request("/?limit=1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.reports).toHaveLength(1);
      expect(json.total).toBe(2);
      expect(json.hasMore).toBe(true);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        limit: 1,
        offset: undefined,
        since: undefined,
        until: undefined,
      });
    });

    it("returns paginated reports with offset", async () => {
      const res = await app.request("/?offset=1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        limit: undefined,
        offset: 1,
        since: undefined,
        until: undefined,
      });
    });

    it("filters reports by since parameter", async () => {
      const res = await app.request("/?since=2024-01-02T00:00:00.000Z");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        since: "2024-01-02T00:00:00.000Z",
        until: undefined,
      });
    });

    it("filters reports by until parameter", async () => {
      const res = await app.request("/?until=2024-01-01T23:59:59.999Z");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        since: undefined,
        until: "2024-01-01T23:59:59.999Z",
      });
    });

    it("combines multiple query parameters", async () => {
      const res = await app.request("/?limit=10&offset=5&since=2024-01-01T00:00:00.000Z");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        since: "2024-01-01T00:00:00.000Z",
        until: undefined,
      });
    });
  });

  describe("GET /violations", () => {
    it("returns all violations", async () => {
      const res = await app.request("/violations");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.violations).toHaveLength(2);
      expect(json.total).toBe(2);
      expect(json.hasMore).toBe(false);
      expect(json.lastUpdated).toBeDefined();
    });

    it("returns paginated violations", async () => {
      const res = await app.request("/violations?limit=1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.violations).toHaveLength(1);
      expect(json.hasMore).toBe(true);
    });

    it("filters violations by since", async () => {
      const res = await app.request("/violations?since=2024-01-02T00:00:00.000Z");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getViolations).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        since: "2024-01-02T00:00:00.000Z",
        until: undefined,
      });
    });
  });

  describe("GET /network", () => {
    it("returns all network requests", async () => {
      const res = await app.request("/network");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.requests).toHaveLength(2);
      expect(json.total).toBe(2);
      expect(json.hasMore).toBe(false);
      expect(json.lastUpdated).toBeDefined();
    });

    it("returns paginated network requests", async () => {
      const res = await app.request("/network?limit=1&offset=0");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.requests).toHaveLength(1);
      expect(json.hasMore).toBe(true);
    });

    it("filters network requests by since", async () => {
      const res = await app.request("/network?since=2024-01-02T00:00:00.000Z");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getNetworkRequests).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        since: "2024-01-02T00:00:00.000Z",
        until: undefined,
      });
    });
  });

  describe("POST /", () => {
    it("inserts reports and returns success", async () => {
      const reports: CSPReport[] = [
        {
          id: "r3",
          domain: "new.com",
          timestamp: "2024-01-03T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.totalReports).toBe(4); // violations + requests
      expect(mockAdapter.insertReports).toHaveBeenCalledWith(reports);
    });

    it("handles empty reports array", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: [] }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockAdapter.insertReports).not.toHaveBeenCalled();
    });

    it("handles missing reports field", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockAdapter.insertReports).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /", () => {
    it("clears all data", async () => {
      const res = await app.request("/", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockAdapter.clearAll).toHaveBeenCalled();
    });
  });

  describe("DELETE /old", () => {
    it("deletes old reports", async () => {
      const res = await app.request("/old?before=2024-01-02T00:00:00.000Z", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(1);
      expect(mockAdapter.deleteOldReports).toHaveBeenCalledWith("2024-01-02T00:00:00.000Z");
    });

    it("returns error when before parameter is missing", async () => {
      const res = await app.request("/old", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("before");
    });
  });
});

describe("parseQueryOptions", () => {
  let mockAdapter: DatabaseAdapter;
  let app: ReturnType<typeof createReportsRoutes>;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    app = createReportsRoutes(mockAdapter);
  });

  it("parses integer limit correctly", async () => {
    await app.request("/?limit=50");

    expect(mockAdapter.getReports).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  it("parses integer offset correctly", async () => {
    await app.request("/?offset=25");

    expect(mockAdapter.getReports).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 25 })
    );
  });

  it("handles invalid limit gracefully", async () => {
    await app.request("/?limit=invalid");

    expect(mockAdapter.getReports).toHaveBeenCalledWith(
      expect.objectContaining({ limit: NaN })
    );
  });

  it("handles zero limit", async () => {
    await app.request("/?limit=0");

    expect(mockAdapter.getReports).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 0 })
    );
  });

  it("handles negative limit", async () => {
    await app.request("/?limit=-1");

    expect(mockAdapter.getReports).toHaveBeenCalledWith(
      expect.objectContaining({ limit: -1 })
    );
  });
});
