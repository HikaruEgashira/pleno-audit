import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const mockPostReports = vi.hoisted(() => vi.fn());

// Mock api-client
vi.mock("./api-client.js", () => ({
  getApiClient: vi.fn().mockResolvedValue({
    postReports: mockPostReports,
  }),
}));

// Mock chrome API
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockStorageRemove = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
      remove: mockStorageRemove,
    },
  },
});

import { checkMigrationNeeded, migrateToDatabase } from "./migration.js";

describe("migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
    mockStorageRemove.mockResolvedValue(undefined);
    mockPostReports.mockResolvedValue({ success: true });
  });

  describe("checkMigrationNeeded", () => {
    it("returns false when migration already completed", async () => {
      mockStorageGet.mockResolvedValue({ duckdbMigrationCompleted: true });

      const result = await checkMigrationNeeded();

      expect(result).toBe(false);
    });

    it("returns false when no legacy reports", async () => {
      mockStorageGet.mockResolvedValue({ cspReports: [] });

      const result = await checkMigrationNeeded();

      expect(result).toBe(false);
    });

    it("returns false when cspReports is undefined", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await checkMigrationNeeded();

      expect(result).toBe(false);
    });

    it("returns true when legacy reports exist and not migrated", async () => {
      mockStorageGet.mockResolvedValue({
        cspReports: [
          { id: "1", domain: "example.com", timestamp: "2024-01-01", violations: [], requests: [] },
        ],
      });

      const result = await checkMigrationNeeded();

      expect(result).toBe(true);
    });

    it("returns false when cspReports is not an array", async () => {
      mockStorageGet.mockResolvedValue({ cspReports: "invalid" });

      const result = await checkMigrationNeeded();

      expect(result).toBe(false);
    });
  });

  describe("migrateToDatabase", () => {
    it("returns success immediately if already migrated", async () => {
      mockStorageGet.mockResolvedValue({ duckdbMigrationCompleted: true });

      const result = await migrateToDatabase();

      expect(result).toEqual({ success: true, migratedCount: 0 });
      expect(mockPostReports).not.toHaveBeenCalled();
    });

    it("marks migration complete and returns 0 if no legacy reports", async () => {
      mockStorageGet.mockResolvedValue({ cspReports: [] });

      const result = await migrateToDatabase();

      expect(result).toEqual({ success: true, migratedCount: 0 });
      expect(mockStorageSet).toHaveBeenCalledWith({ duckdbMigrationCompleted: true });
      expect(mockPostReports).not.toHaveBeenCalled();
    });

    it("migrates legacy reports in batches", async () => {
      const reports = Array.from({ length: 250 }, (_, i) => ({
        id: `report-${i}`,
        domain: `example${i}.com`,
        timestamp: "2024-01-01",
        violations: [],
        requests: [],
      }));

      mockStorageGet.mockResolvedValue({ cspReports: reports });

      const result = await migrateToDatabase();

      expect(result).toEqual({ success: true, migratedCount: 250 });
      // 250 reports / 100 batch size = 3 batches
      expect(mockPostReports).toHaveBeenCalledTimes(3);
      expect(mockPostReports).toHaveBeenNthCalledWith(1, reports.slice(0, 100));
      expect(mockPostReports).toHaveBeenNthCalledWith(2, reports.slice(100, 200));
      expect(mockPostReports).toHaveBeenNthCalledWith(3, reports.slice(200, 250));
    });

    it("marks migration complete after migrating", async () => {
      const reports = [
        { id: "1", domain: "example.com", timestamp: "2024-01-01", violations: [], requests: [] },
      ];

      mockStorageGet.mockResolvedValue({ cspReports: reports });

      await migrateToDatabase();

      expect(mockStorageSet).toHaveBeenCalledWith({ duckdbMigrationCompleted: true });
    });

    it("removes legacy reports after migration", async () => {
      const reports = [
        { id: "1", domain: "example.com", timestamp: "2024-01-01", violations: [], requests: [] },
      ];

      mockStorageGet.mockResolvedValue({ cspReports: reports });

      await migrateToDatabase();

      expect(mockStorageRemove).toHaveBeenCalledWith(["cspReports"]);
    });

    it("handles undefined cspReports", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await migrateToDatabase();

      expect(result).toEqual({ success: true, migratedCount: 0 });
    });

    it("migrates exact batch size correctly", async () => {
      const reports = Array.from({ length: 100 }, (_, i) => ({
        id: `report-${i}`,
        domain: `example${i}.com`,
        timestamp: "2024-01-01",
        violations: [],
        requests: [],
      }));

      mockStorageGet.mockResolvedValue({ cspReports: reports });

      const result = await migrateToDatabase();

      expect(result).toEqual({ success: true, migratedCount: 100 });
      expect(mockPostReports).toHaveBeenCalledTimes(1);
    });

    it("migrates less than batch size correctly", async () => {
      const reports = Array.from({ length: 50 }, (_, i) => ({
        id: `report-${i}`,
        domain: `example${i}.com`,
        timestamp: "2024-01-01",
        violations: [],
        requests: [],
      }));

      mockStorageGet.mockResolvedValue({ cspReports: reports });

      const result = await migrateToDatabase();

      expect(result).toEqual({ success: true, migratedCount: 50 });
      expect(mockPostReports).toHaveBeenCalledTimes(1);
      expect(mockPostReports).toHaveBeenCalledWith(reports);
    });
  });
});
