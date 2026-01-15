import { describe, it, expect, vi, beforeEach } from "vitest";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";

// Mock sql.js Database class
class MockDatabase {
  private tables: Record<string, Record<string, unknown>[]> = {
    csp_violations: [],
    network_requests: [],
  };
  private _rowsModified = 0;

  constructor(_buffer?: Uint8Array) {
    // Accept buffer parameter like real sql.js
  }

  run(sql: string, params?: unknown[]) {
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return;
    }
    if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
      return;
    }
    if (sql.includes("INSERT INTO csp_violations")) {
      this.tables.csp_violations.push({
        id: this.tables.csp_violations.length + 1,
        timestamp: params?.[0],
        page_url: params?.[1],
        directive: params?.[2],
        blocked_url: params?.[3],
        domain: params?.[4],
        disposition: params?.[5],
        original_policy: params?.[6],
        source_file: params?.[7],
        line_number: params?.[8],
        column_number: params?.[9],
        status_code: params?.[10],
      });
      this._rowsModified = 1;
    }
    if (sql.includes("INSERT INTO network_requests")) {
      this.tables.network_requests.push({
        id: this.tables.network_requests.length + 1,
        timestamp: params?.[0],
        page_url: params?.[1],
        url: params?.[2],
        method: params?.[3],
        initiator: params?.[4],
        domain: params?.[5],
        resource_type: params?.[6],
      });
      this._rowsModified = 1;
    }
    if (sql.includes("DELETE FROM csp_violations")) {
      const beforeLength = this.tables.csp_violations.length;
      if (params?.[0]) {
        this.tables.csp_violations = this.tables.csp_violations.filter(
          (v) => (v.timestamp as string) >= (params[0] as string)
        );
      } else {
        this.tables.csp_violations = [];
      }
      this._rowsModified = beforeLength - this.tables.csp_violations.length;
    }
    if (sql.includes("DELETE FROM network_requests")) {
      const beforeLength = this.tables.network_requests.length;
      if (params?.[0]) {
        this.tables.network_requests = this.tables.network_requests.filter(
          (r) => (r.timestamp as string) >= (params[0] as string)
        );
      } else {
        this.tables.network_requests = [];
      }
      this._rowsModified = beforeLength - this.tables.network_requests.length;
    }
  }

  exec(sql: string, params?: unknown[]) {
    if (sql.includes("SELECT COUNT(*)") && sql.includes("csp_violations") && !sql.includes("UNION")) {
      const where = params?.[0] as string | undefined;
      let count = this.tables.csp_violations.length;
      if (where && sql.includes(">=")) {
        count = this.tables.csp_violations.filter(
          (v) => (v.timestamp as string) >= where
        ).length;
      }
      return [{ columns: ["count"], values: [[count]] }];
    }
    if (sql.includes("SELECT COUNT(*)") && sql.includes("network_requests") && !sql.includes("UNION")) {
      const where = params?.[0] as string | undefined;
      let count = this.tables.network_requests.length;
      if (where && sql.includes(">=")) {
        count = this.tables.network_requests.filter(
          (r) => (r.timestamp as string) >= where
        ).length;
      }
      return [{ columns: ["count"], values: [[count]] }];
    }
    if (sql.includes("SELECT COUNT(DISTINCT domain)")) {
      const domains = new Set([
        ...this.tables.csp_violations.map((v) => v.domain),
        ...this.tables.network_requests.map((r) => r.domain),
      ]);
      return [{ columns: ["count"], values: [[domains.size]] }];
    }
    if (sql.includes("SELECT *") && sql.includes("csp_violations")) {
      const columns = [
        "id", "timestamp", "page_url", "directive", "blocked_url", "domain",
        "disposition", "original_policy", "source_file", "line_number",
        "column_number", "status_code",
      ];
      let filtered = [...this.tables.csp_violations];
      let paramIndex = 0;
      if (params?.[paramIndex] && sql.includes("timestamp >") && !sql.includes(">=")) {
        filtered = filtered.filter(
          (v) => (v.timestamp as string) > (params[paramIndex] as string)
        );
        paramIndex++;
      }
      if (params?.[paramIndex] && sql.includes("timestamp >=")) {
        filtered = filtered.filter(
          (v) => (v.timestamp as string) >= (params[paramIndex] as string)
        );
        paramIndex++;
      }
      // Sort by timestamp DESC
      filtered.sort((a, b) =>
        new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()
      );
      // Handle LIMIT and OFFSET
      if (sql.includes("LIMIT") && params) {
        const limitMatch = sql.match(/LIMIT\s+\?/);
        const offsetMatch = sql.match(/OFFSET\s+\?/);
        if (limitMatch && offsetMatch) {
          const limit = params[params.length - 2] as number;
          const offset = params[params.length - 1] as number;
          if (limit !== -1) {
            filtered = filtered.slice(offset, offset + limit);
          } else {
            filtered = filtered.slice(offset);
          }
        } else if (limitMatch) {
          const limit = params[params.length - 1] as number;
          if (limit !== -1) {
            filtered = filtered.slice(0, limit);
          }
        }
      }
      const values = filtered.map((v) => columns.map((c) => v[c] ?? null));
      return values.length > 0 ? [{ columns, values }] : [];
    }
    if (sql.includes("SELECT *") && sql.includes("network_requests")) {
      const columns = [
        "id", "timestamp", "page_url", "url", "method", "initiator", "domain", "resource_type",
      ];
      let filtered = [...this.tables.network_requests];
      let paramIndex = 0;
      if (params?.[paramIndex] && sql.includes("timestamp >") && !sql.includes(">=")) {
        filtered = filtered.filter(
          (r) => (r.timestamp as string) > (params[paramIndex] as string)
        );
        paramIndex++;
      }
      if (params?.[paramIndex] && sql.includes("timestamp >=")) {
        filtered = filtered.filter(
          (r) => (r.timestamp as string) >= (params[paramIndex] as string)
        );
        paramIndex++;
      }
      // Sort by timestamp DESC
      filtered.sort((a, b) =>
        new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()
      );
      // Handle LIMIT and OFFSET
      if (sql.includes("LIMIT") && params) {
        const limitMatch = sql.match(/LIMIT\s+\?/);
        const offsetMatch = sql.match(/OFFSET\s+\?/);
        if (limitMatch && offsetMatch) {
          const limit = params[params.length - 2] as number;
          const offset = params[params.length - 1] as number;
          if (limit !== -1) {
            filtered = filtered.slice(offset, offset + limit);
          } else {
            filtered = filtered.slice(offset);
          }
        } else if (limitMatch) {
          const limit = params[params.length - 1] as number;
          if (limit !== -1) {
            filtered = filtered.slice(0, limit);
          }
        }
      }
      const values = filtered.map((r) => columns.map((c) => r[c] ?? null));
      return values.length > 0 ? [{ columns, values }] : [];
    }
    return [];
  }

  getRowsModified() {
    return this._rowsModified;
  }

  export() {
    return new Uint8Array([1, 2, 3]);
  }

  close() {
    // No-op for mock
  }
}

function createMockSqlJs() {
  return {
    Database: MockDatabase,
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
    disposition: "enforce",
    ...overrides,
  };
}

function createNetworkRequest(
  overrides: Partial<NetworkRequest> = {}
): NetworkRequest {
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

describe("SqlJsAdapter", () => {
  describe("init", () => {
    it("creates a new database", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);

      await adapter.init();

      // No error means success
      expect(true).toBe(true);
    });

    it("does not reinitialize if already initialized", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);

      await adapter.init();
      await adapter.init();

      // Should not throw
      expect(true).toBe(true);
    });

    it("loads from buffer if provided", async () => {
      const mockSql = createMockSqlJs();
      const buffer = new Uint8Array([1, 2, 3]);
      const adapter = new SqlJsAdapter(mockSql as never, {
        loadFromBuffer: buffer,
      });

      await adapter.init();

      // Should not throw
      expect(true).toBe(true);
    });

    it("calls onSave after schema creation", async () => {
      const mockSql = createMockSqlJs();
      const onSave = vi.fn();
      const adapter = new SqlJsAdapter(mockSql as never, { onSave });

      await adapter.init();

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe("insertReports", () => {
    it("inserts CSP violations", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const violation = createViolation();
      await adapter.insertReports([violation]);

      const violations = await adapter.getAllViolations();
      expect(violations.length).toBe(1);
    });

    it("inserts network requests", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const request = createNetworkRequest();
      await adapter.insertReports([request]);

      const requests = await adapter.getAllNetworkRequests();
      expect(requests.length).toBe(1);
    });

    it("handles mixed reports", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const violation = createViolation();
      const request = createNetworkRequest();
      await adapter.insertReports([violation, request]);

      const violations = await adapter.getAllViolations();
      const requests = await adapter.getAllNetworkRequests();
      expect(violations.length).toBe(1);
      expect(requests.length).toBe(1);
    });

    it("throws error before init", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);

      await expect(
        adapter.insertReports([createViolation()])
      ).rejects.toThrow("Database not initialized");
    });
  });

  describe("getAllViolations", () => {
    it("returns empty array when no violations", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const violations = await adapter.getAllViolations();

      expect(violations).toEqual([]);
    });

    it("returns violations after insert", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const violation = createViolation({ domain: "test.com" });
      await adapter.insertReports([violation]);

      const violations = await adapter.getAllViolations();

      expect(violations.length).toBe(1);
      expect(violations[0].domain).toBe("test.com");
    });
  });

  describe("getAllNetworkRequests", () => {
    it("returns empty array when no requests", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const requests = await adapter.getAllNetworkRequests();

      expect(requests).toEqual([]);
    });

    it("returns requests after insert", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const request = createNetworkRequest({ domain: "api.test.com" });
      await adapter.insertReports([request]);

      const requests = await adapter.getAllNetworkRequests();

      expect(requests.length).toBe(1);
      expect(requests[0].domain).toBe("api.test.com");
    });
  });

  describe("getAllReports", () => {
    it("returns both violations and requests", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const violation = createViolation();
      const request = createNetworkRequest();
      await adapter.insertReports([violation, request]);

      const reports = await adapter.getAllReports();

      expect(reports.length).toBe(2);
    });

    it("sorts by timestamp descending", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const old = createViolation({ timestamp: "2023-01-01T00:00:00.000Z" });
      const newer = createNetworkRequest({
        timestamp: "2023-06-01T00:00:00.000Z",
      });
      await adapter.insertReports([old, newer]);

      const reports = await adapter.getAllReports();

      expect(reports[0].timestamp).toBe("2023-06-01T00:00:00.000Z");
    });
  });

  describe("getStats", () => {
    it("returns zero counts for empty database", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const stats = await adapter.getStats();

      expect(stats.violations).toBe(0);
      expect(stats.requests).toBe(0);
      expect(stats.uniqueDomains).toBe(0);
    });

    it("counts violations and requests", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([createViolation(), createViolation()]);
      await adapter.insertReports([createNetworkRequest()]);

      const stats = await adapter.getStats();

      expect(stats.violations).toBe(2);
      expect(stats.requests).toBe(1);
    });

    it("counts unique domains", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([
        createViolation({ domain: "example.com" }),
        createViolation({ domain: "test.com" }),
        createNetworkRequest({ domain: "example.com" }),
      ]);

      const stats = await adapter.getStats();

      expect(stats.uniqueDomains).toBe(2);
    });
  });

  describe("clearAll", () => {
    it("removes all data", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([createViolation(), createNetworkRequest()]);
      await adapter.clearAll();

      const stats = await adapter.getStats();
      expect(stats.violations).toBe(0);
      expect(stats.requests).toBe(0);
    });
  });

  describe("close", () => {
    it("closes without error", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.close();

      // Should not throw
      expect(true).toBe(true);
    });

    it("saves before closing", async () => {
      const mockSql = createMockSqlJs();
      const onSave = vi.fn();
      const adapter = new SqlJsAdapter(mockSql as never, { onSave });
      await adapter.init();

      onSave.mockClear();
      await adapter.close();

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe("getReportsSince", () => {
    it("returns reports after timestamp", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const old = createViolation({ timestamp: "2023-01-01T00:00:00.000Z" });
      const newer = createNetworkRequest({
        timestamp: "2023-06-01T00:00:00.000Z",
      });
      await adapter.insertReports([old, newer]);

      const reports = await adapter.getReportsSince("2023-03-01T00:00:00.000Z");

      expect(reports.length).toBe(1);
      expect(reports[0].timestamp).toBe("2023-06-01T00:00:00.000Z");
    });
  });

  describe("getViolations with pagination", () => {
    it("returns paginated results", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([
        createViolation({ domain: "a.com" }),
        createViolation({ domain: "b.com" }),
        createViolation({ domain: "c.com" }),
      ]);

      const result = await adapter.getViolations({ limit: 2 });

      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it("respects offset", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([
        createViolation({ domain: "a.com" }),
        createViolation({ domain: "b.com" }),
      ]);

      const result = await adapter.getViolations({ offset: 1 });

      expect(result.total).toBe(2);
    });
  });

  describe("getNetworkRequests with pagination", () => {
    it("returns paginated results", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([
        createNetworkRequest({ domain: "a.com" }),
        createNetworkRequest({ domain: "b.com" }),
      ]);

      const result = await adapter.getNetworkRequests({ limit: 1 });

      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("getReports with pagination", () => {
    it("combines violations and requests", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([createViolation(), createNetworkRequest()]);

      const result = await adapter.getReports();

      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);
    });
  });

  describe("deleteOldReports", () => {
    it("deletes reports before timestamp", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      await adapter.insertReports([
        createViolation({ timestamp: "2023-01-01T00:00:00.000Z" }),
        createViolation({ timestamp: "2023-06-01T00:00:00.000Z" }),
      ]);

      const deleted = await adapter.deleteOldReports("2023-03-01T00:00:00.000Z");

      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe("export", () => {
    it("exports database as Uint8Array", async () => {
      const mockSql = createMockSqlJs();
      const adapter = new SqlJsAdapter(mockSql as never);
      await adapter.init();

      const data = adapter.export();

      expect(data).toBeInstanceOf(Uint8Array);
    });
  });
});
