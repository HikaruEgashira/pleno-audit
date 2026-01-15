import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSyncRoutes } from "./sync.js";
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
    {
      id: "r3",
      domain: "new.com",
      timestamp: "2024-01-03T00:00:00.000Z",
      violations: [],
      requests: [],
    },
  ];

  return {
    init: vi.fn().mockResolvedValue(undefined),
    insertReports: vi.fn().mockResolvedValue(undefined),
    getAllReports: vi.fn().mockResolvedValue(reports),
    getAllViolations: vi.fn().mockResolvedValue([]),
    getAllNetworkRequests: vi.fn().mockResolvedValue([]),
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
      const limit = options?.limit ?? 500; // default batch size
      const sliced = limit === -1 ? filtered.slice(offset) : filtered.slice(offset, offset + limit);
      return {
        data: sliced,
        total: filtered.length,
        hasMore: limit !== -1 && offset + limit < filtered.length,
      } as PaginatedResult<CSPReport>;
    }),
    getViolations: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    getNetworkRequests: vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false }),
    getStats: vi.fn().mockResolvedValue({
      violations: 0,
      requests: 0,
      events: 0,
      uniqueDomains: 3,
    } as DatabaseStats),
    deleteOldReports: vi.fn().mockResolvedValue(0),
    clearAll: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createSyncRoutes", () => {
  let mockAdapter: DatabaseAdapter;
  let app: ReturnType<typeof createSyncRoutes>;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    app = createSyncRoutes(mockAdapter);
  });

  describe("GET /", () => {
    it("returns reports with default parameters", async () => {
      const res = await app.request("/");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.reports).toHaveLength(3);
      expect(json.total).toBe(3);
      expect(json.hasMore).toBe(false);
      expect(json.serverTime).toBeDefined();
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "1970-01-01T00:00:00.000Z",
        limit: 500,
      });
    });

    it("uses since parameter", async () => {
      const res = await app.request("/?since=2024-01-02T00:00:00.000Z");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "2024-01-02T00:00:00.000Z",
        limit: 500,
      });
    });

    it("uses custom limit parameter", async () => {
      const res = await app.request("/?limit=10");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "1970-01-01T00:00:00.000Z",
        limit: 10,
      });
    });

    it("combines since and limit parameters", async () => {
      const res = await app.request("/?since=2024-01-01T00:00:00.000Z&limit=100");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "2024-01-01T00:00:00.000Z",
        limit: 100,
      });
    });

    it("returns serverTime in ISO format", async () => {
      const res = await app.request("/");
      const json = await res.json();

      expect(json.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it("indicates hasMore when there are more records", async () => {
      // Mock adapter to return hasMore = true
      (mockAdapter.getReports as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: "r1", domain: "example.com", timestamp: "2024-01-01T00:00:00.000Z", violations: [], requests: [] }],
        total: 100,
        hasMore: true,
      });

      const res = await app.request("/?limit=1");
      const json = await res.json();

      expect(json.hasMore).toBe(true);
    });
  });

  describe("POST /", () => {
    it("inserts reports and returns server reports", async () => {
      const clientReports: CSPReport[] = [
        {
          id: "c1",
          domain: "client.com",
          timestamp: "2024-01-04T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: clientReports,
          clientTime: "2024-01-01T00:00:00.000Z",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.serverReports).toBeDefined();
      expect(json.total).toBe(3);
      expect(json.hasMore).toBe(false);
      expect(json.serverTime).toBeDefined();
      expect(mockAdapter.insertReports).toHaveBeenCalledWith(clientReports);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "2024-01-01T00:00:00.000Z",
        limit: 500,
      });
    });

    it("handles empty reports array", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: [],
          clientTime: "2024-01-01T00:00:00.000Z",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.serverReports).toBeDefined();
      expect(mockAdapter.insertReports).not.toHaveBeenCalled();
    });

    it("handles missing reports field", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientTime: "2024-01-01T00:00:00.000Z",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.insertReports).not.toHaveBeenCalled();
    });

    it("uses default clientTime when not provided", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: [],
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "1970-01-01T00:00:00.000Z",
        limit: 500,
      });
    });

    it("uses custom limit from request body", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: [],
          clientTime: "2024-01-01T00:00:00.000Z",
          limit: 100,
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "2024-01-01T00:00:00.000Z",
        limit: 100,
      });
    });

    it("returns serverTime in ISO format", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: [],
          clientTime: "2024-01-01T00:00:00.000Z",
        }),
      });
      const json = await res.json();

      expect(json.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it("inserts multiple reports at once", async () => {
      const clientReports: CSPReport[] = [
        {
          id: "c1",
          domain: "client1.com",
          timestamp: "2024-01-04T00:00:00.000Z",
          violations: [],
          requests: [],
        },
        {
          id: "c2",
          domain: "client2.com",
          timestamp: "2024-01-05T00:00:00.000Z",
          violations: [],
          requests: [],
        },
        {
          id: "c3",
          domain: "client3.com",
          timestamp: "2024-01-06T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: clientReports,
          clientTime: "2024-01-01T00:00:00.000Z",
        }),
      });

      expect(res.status).toBe(200);
      expect(mockAdapter.insertReports).toHaveBeenCalledWith(clientReports);
    });
  });

  describe("sync workflow", () => {
    it("simulates initial sync from client", async () => {
      // Client has no data, requests all server data
      const res = await app.request("/");
      const json = await res.json();

      expect(json.reports).toHaveLength(3);
      expect(json.serverTime).toBeDefined();
    });

    it("simulates incremental sync", async () => {
      // Client requests only new data since last sync
      const lastSyncTime = "2024-01-02T00:00:00.000Z";
      const res = await app.request(`/?since=${lastSyncTime}`);
      const json = await res.json();

      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: lastSyncTime,
        limit: 500,
      });
    });

    it("simulates bidirectional sync", async () => {
      // Client sends new data and receives server updates
      const clientReports: CSPReport[] = [
        {
          id: "local1",
          domain: "local.com",
          timestamp: "2024-01-10T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: clientReports,
          clientTime: "2024-01-05T00:00:00.000Z",
          limit: 100,
        }),
      });
      const json = await res.json();

      // Verify client data was inserted
      expect(mockAdapter.insertReports).toHaveBeenCalledWith(clientReports);

      // Verify server returns updates since clientTime
      expect(mockAdapter.getReports).toHaveBeenCalledWith({
        since: "2024-01-05T00:00:00.000Z",
        limit: 100,
      });

      expect(json.serverReports).toBeDefined();
      expect(json.serverTime).toBeDefined();
    });
  });
});
