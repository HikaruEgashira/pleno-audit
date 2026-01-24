import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Mock dependencies
vi.mock("@pleno-audit/detectors", () => ({
  DEFAULT_NRD_CONFIG: { enabled: true, checkInterval: 3600000 },
  DEFAULT_AI_MONITOR_CONFIG: { enabled: true },
}));

vi.mock("@pleno-audit/csp", () => ({
  DEFAULT_CSP_CONFIG: { enabled: true, reportOnly: false },
}));

vi.mock("./extension-monitor.js", () => ({
  DEFAULT_EXTENSION_MONITOR_CONFIG: { enabled: true },
}));

import {
  getStorage,
  setStorage,
  getStorageKey,
  getServiceCount,
  clearCSPReports,
  clearAIPrompts,
  queueStorageOperation,
} from "./storage.js";

describe("storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
    mockStorageRemove.mockResolvedValue(undefined);
  });

  describe("getStorage", () => {
    it("returns default values when storage is empty", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorage();

      expect(result.services).toEqual({});
      expect(result.events).toEqual([]);
      expect(result.cspReports).toEqual([]);
      expect(result.aiPrompts).toEqual([]);
      expect(result.extensionRequests).toEqual([]);
    });

    it("returns stored values when available", async () => {
      const services = { "example.com": { domain: "example.com", firstSeen: "2024-01-01" } };
      const events = [{ type: "page_visit", timestamp: "2024-01-01" }];

      mockStorageGet.mockResolvedValue({ services, events });

      const result = await getStorage();

      expect(result.services).toEqual(services);
      expect(result.events).toEqual(events);
    });

    it("merges stored and default configs", async () => {
      const cspConfig = { enabled: false, reportOnly: true };

      mockStorageGet.mockResolvedValue({ cspConfig });

      const result = await getStorage();

      expect(result.cspConfig).toEqual(cspConfig);
    });

    it("fetches all storage keys", async () => {
      await getStorage();

      expect(mockStorageGet).toHaveBeenCalledWith(
        expect.arrayContaining([
          "services",
          "events",
          "cspReports",
          "cspConfig",
          "aiPrompts",
          "aiMonitorConfig",
          "nrdConfig",
          "extensionRequests",
          "extensionMonitorConfig",
          "dataRetentionConfig",
          "detectionConfig",
          "blockingConfig",
        ])
      );
    });
  });

  describe("setStorage", () => {
    it("sets storage data", async () => {
      const data = { services: { "test.com": { domain: "test.com" } } };

      await setStorage(data);

      expect(mockStorageSet).toHaveBeenCalledWith(data);
    });

    it("allows partial updates", async () => {
      await setStorage({ events: [{ type: "test" }] });

      expect(mockStorageSet).toHaveBeenCalledWith({ events: [{ type: "test" }] });
    });
  });

  describe("getStorageKey", () => {
    it("returns specific key value", async () => {
      const services = { "example.com": { domain: "example.com" } };
      mockStorageGet.mockResolvedValue({ services });

      const result = await getStorageKey("services");

      expect(result).toEqual(services);
      expect(mockStorageGet).toHaveBeenCalledWith(["services"]);
    });

    it("returns default for missing key", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("services");

      expect(result).toEqual({});
    });

    it("returns default for events", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("events");

      expect(result).toEqual([]);
    });

    it("returns default for cspReports", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("cspReports");

      expect(result).toEqual([]);
    });

    it("returns default config for cspConfig", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("cspConfig");

      expect(result).toEqual({ enabled: true, reportOnly: false });
    });

    it("returns default config for aiMonitorConfig", async () => {
      mockStorageGet.mockResolvedValue({});

      const result = await getStorageKey("aiMonitorConfig");

      expect(result).toEqual({ enabled: true });
    });
  });

  describe("getServiceCount", () => {
    it("returns 0 when no services", async () => {
      mockStorageGet.mockResolvedValue({});

      const count = await getServiceCount();

      expect(count).toBe(0);
    });

    it("returns correct count of services", async () => {
      mockStorageGet.mockResolvedValue({
        services: {
          "example.com": { domain: "example.com" },
          "test.com": { domain: "test.com" },
          "demo.com": { domain: "demo.com" },
        },
      });

      const count = await getServiceCount();

      expect(count).toBe(3);
    });
  });

  describe("clearCSPReports", () => {
    it("removes cspReports from storage", async () => {
      await clearCSPReports();

      expect(mockStorageRemove).toHaveBeenCalledWith(["cspReports"]);
    });
  });

  describe("clearAIPrompts", () => {
    it("removes aiPrompts from storage", async () => {
      await clearAIPrompts();

      expect(mockStorageRemove).toHaveBeenCalledWith(["aiPrompts"]);
    });
  });

  describe("queueStorageOperation", () => {
    it("executes operations sequentially", async () => {
      const order: number[] = [];

      const op1 = queueStorageOperation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
        return 1;
      });

      const op2 = queueStorageOperation(async () => {
        order.push(2);
        return 2;
      });

      const op3 = queueStorageOperation(async () => {
        order.push(3);
        return 3;
      });

      const results = await Promise.all([op1, op2, op3]);

      expect(results).toEqual([1, 2, 3]);
      expect(order).toEqual([1, 2, 3]);
    });

    it("returns operation result", async () => {
      const result = await queueStorageOperation(async () => "test result");

      expect(result).toBe("test result");
    });

    it("propagates errors", async () => {
      await expect(
        queueStorageOperation(async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });

    it("continues queue after error", async () => {
      const errorOp = queueStorageOperation(async () => {
        throw new Error("Error");
      }).catch(() => "caught");

      const successOp = queueStorageOperation(async () => "success");

      const results = await Promise.all([errorOp, successOp]);

      expect(results).toEqual(["caught", "success"]);
    });
  });
});
