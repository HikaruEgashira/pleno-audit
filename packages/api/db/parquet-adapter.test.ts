import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CSPReport, CSPViolation, NetworkRequest } from "@pleno-audit/csp";

// Mock the logger
vi.mock("@pleno-audit/extension-runtime", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock ParquetStore methods
const mockInit = vi.fn();
const mockInsertReports = vi.fn();
const mockGetReports = vi.fn();
const mockGetViolations = vi.fn();
const mockGetNetworkRequests = vi.fn();
const mockGetStats = vi.fn();
const mockDeleteOldReports = vi.fn();
const mockClearAll = vi.fn();

// Mock ParquetStore class
vi.mock("@pleno-audit/parquet-storage", () => ({
  ParquetStore: class MockParquetStore {
    init = mockInit;
    insertReports = mockInsertReports;
    getReports = mockGetReports;
    getViolations = mockGetViolations;
    getNetworkRequests = mockGetNetworkRequests;
    getStats = mockGetStats;
    deleteOldReports = mockDeleteOldReports;
    clearAll = mockClearAll;
  },
}));

import { ParquetAdapter } from "./parquet-adapter.js";

describe("ParquetAdapter", () => {
  let adapter: ParquetAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ParquetAdapter();
  });

  describe("init", () => {
    it("initializes the parquet store", async () => {
      mockInit.mockResolvedValue(undefined);

      await adapter.init();

      expect(mockInit).toHaveBeenCalled();
    });

    it("throws error when initialization fails", async () => {
      const error = new Error("Init failed");
      mockInit.mockRejectedValue(error);

      await expect(adapter.init()).rejects.toThrow("Init failed");
    });
  });

  describe("insertReports", () => {
    it("inserts reports into parquet store", async () => {
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockInsertReports.mockResolvedValue(undefined);

      await adapter.insertReports(reports);

      expect(mockInsertReports).toHaveBeenCalledWith(reports);
    });

    it("throws error when insert fails", async () => {
      const error = new Error("Insert failed");
      mockInsertReports.mockRejectedValue(error);

      await expect(adapter.insertReports([])).rejects.toThrow("Insert failed");
    });
  });

  describe("getAllReports", () => {
    it("returns all reports", async () => {
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
      mockGetReports.mockResolvedValue({ data: reports, total: 2, hasMore: false });

      const result = await adapter.getAllReports();

      expect(result).toEqual(reports);
      expect(mockGetReports).toHaveBeenCalledWith({ limit: -1 });
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get failed");
      mockGetReports.mockRejectedValue(error);

      await expect(adapter.getAllReports()).rejects.toThrow("Get failed");
    });
  });

  describe("getAllViolations", () => {
    it("returns all violations", async () => {
      const violations: CSPViolation[] = [
        {
          domain: "example.com",
          directive: "script-src",
          blockedURL: "https://evil.com/script.js",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ];
      mockGetViolations.mockResolvedValue({ data: violations, total: 1, hasMore: false });

      const result = await adapter.getAllViolations();

      expect(result).toEqual(violations);
      expect(mockGetViolations).toHaveBeenCalledWith({ limit: -1 });
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get violations failed");
      mockGetViolations.mockRejectedValue(error);

      await expect(adapter.getAllViolations()).rejects.toThrow("Get violations failed");
    });
  });

  describe("getAllNetworkRequests", () => {
    it("returns all network requests", async () => {
      const requests: NetworkRequest[] = [
        {
          url: "https://api.example.com/data",
          domain: "example.com",
          method: "GET",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ];
      mockGetNetworkRequests.mockResolvedValue({ data: requests, total: 1, hasMore: false });

      const result = await adapter.getAllNetworkRequests();

      expect(result).toEqual(requests);
      expect(mockGetNetworkRequests).toHaveBeenCalledWith({ limit: -1 });
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get requests failed");
      mockGetNetworkRequests.mockRejectedValue(error);

      await expect(adapter.getAllNetworkRequests()).rejects.toThrow("Get requests failed");
    });
  });

  describe("getReportsSince", () => {
    it("returns reports since timestamp", async () => {
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-02T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockGetReports.mockResolvedValue({ data: reports, total: 1, hasMore: false });

      const result = await adapter.getReportsSince("2024-01-01T00:00:00.000Z");

      expect(result).toEqual(reports);
      expect(mockGetReports).toHaveBeenCalledWith({
        since: "2024-01-01T00:00:00.000Z",
        limit: -1,
      });
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get since failed");
      mockGetReports.mockRejectedValue(error);

      await expect(adapter.getReportsSince("2024-01-01T00:00:00.000Z")).rejects.toThrow("Get since failed");
    });
  });

  describe("getReports", () => {
    it("returns paginated reports", async () => {
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockGetReports.mockResolvedValue({ data: reports, total: 10, hasMore: true });

      const result = await adapter.getReports({ limit: 1, offset: 0 });

      expect(result).toEqual({ data: reports, total: 10, hasMore: true });
      expect(mockGetReports).toHaveBeenCalledWith({ limit: 1, offset: 0 });
    });

    it("handles undefined options", async () => {
      mockGetReports.mockResolvedValue({ data: [], total: 0, hasMore: false });

      await adapter.getReports();

      expect(mockGetReports).toHaveBeenCalledWith(undefined);
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get reports failed");
      mockGetReports.mockRejectedValue(error);

      await expect(adapter.getReports()).rejects.toThrow("Get reports failed");
    });
  });

  describe("getViolations", () => {
    it("returns paginated violations", async () => {
      const violations: CSPViolation[] = [
        {
          domain: "example.com",
          directive: "script-src",
          blockedURL: "https://evil.com/script.js",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ];
      mockGetViolations.mockResolvedValue({ data: violations, total: 5, hasMore: true });

      const result = await adapter.getViolations({ limit: 1 });

      expect(result).toEqual({ data: violations, total: 5, hasMore: true });
      expect(mockGetViolations).toHaveBeenCalledWith({ limit: 1 });
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get violations failed");
      mockGetViolations.mockRejectedValue(error);

      await expect(adapter.getViolations()).rejects.toThrow("Get violations failed");
    });
  });

  describe("getNetworkRequests", () => {
    it("returns paginated network requests", async () => {
      const requests: NetworkRequest[] = [
        {
          url: "https://api.example.com/data",
          domain: "example.com",
          method: "GET",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ];
      mockGetNetworkRequests.mockResolvedValue({ data: requests, total: 3, hasMore: false });

      const result = await adapter.getNetworkRequests({ offset: 2 });

      expect(result).toEqual({ data: requests, total: 3, hasMore: false });
      expect(mockGetNetworkRequests).toHaveBeenCalledWith({ offset: 2 });
    });

    it("throws error when get fails", async () => {
      const error = new Error("Get network requests failed");
      mockGetNetworkRequests.mockRejectedValue(error);

      await expect(adapter.getNetworkRequests()).rejects.toThrow("Get network requests failed");
    });
  });

  describe("getStats", () => {
    it("returns database stats", async () => {
      const stats = {
        violations: 10,
        requests: 20,
        uniqueDomains: 5,
      };
      mockGetStats.mockResolvedValue(stats);

      const result = await adapter.getStats();

      expect(result).toEqual(stats);
      expect(mockGetStats).toHaveBeenCalled();
    });

    it("throws error when get stats fails", async () => {
      const error = new Error("Get stats failed");
      mockGetStats.mockRejectedValue(error);

      await expect(adapter.getStats()).rejects.toThrow("Get stats failed");
    });
  });

  describe("deleteOldReports", () => {
    it("deletes old reports before timestamp", async () => {
      mockDeleteOldReports.mockResolvedValue(5);

      const result = await adapter.deleteOldReports("2024-01-15T00:00:00.000Z");

      expect(result).toBe(5);
      expect(mockDeleteOldReports).toHaveBeenCalledWith("2024-01-15");
    });

    it("converts ISO timestamp to date", async () => {
      mockDeleteOldReports.mockResolvedValue(0);

      await adapter.deleteOldReports("2024-06-30T23:59:59.999Z");

      expect(mockDeleteOldReports).toHaveBeenCalledWith("2024-06-30");
    });

    it("throws error when delete fails", async () => {
      const error = new Error("Delete failed");
      mockDeleteOldReports.mockRejectedValue(error);

      await expect(adapter.deleteOldReports("2024-01-01T00:00:00.000Z")).rejects.toThrow("Delete failed");
    });
  });

  describe("clearAll", () => {
    it("clears all data", async () => {
      mockClearAll.mockResolvedValue(undefined);

      await adapter.clearAll();

      expect(mockClearAll).toHaveBeenCalled();
    });

    it("throws error when clear fails", async () => {
      const error = new Error("Clear failed");
      mockClearAll.mockRejectedValue(error);

      await expect(adapter.clearAll()).rejects.toThrow("Clear failed");
    });
  });

  describe("close", () => {
    it("closes the adapter gracefully", async () => {
      await expect(adapter.close()).resolves.not.toThrow();
    });
  });
});
