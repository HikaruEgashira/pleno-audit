import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CSPReporter, type ReportPayload } from "./reporter.js";
import type { CSPReport } from "./types.js";

// Mock chrome.runtime.getManifest
vi.stubGlobal("chrome", {
  runtime: {
    getManifest: vi.fn(() => ({
      version: "1.0.0",
    })),
  },
});

// Mock navigator.userAgent
vi.stubGlobal("navigator", {
  userAgent: "Mozilla/5.0 (Test Agent)",
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("CSPReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("creates reporter with endpoint", () => {
      const reporter = new CSPReporter("https://example.com/report");
      expect(reporter).toBeDefined();
    });

    it("creates reporter with null endpoint", () => {
      const reporter = new CSPReporter(null);
      expect(reporter).toBeDefined();
    });
  });

  describe("send", () => {
    it("returns false when endpoint is null", async () => {
      const reporter = new CSPReporter(null);
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      const result = await reporter.send(reports);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns false when reports array is empty", async () => {
      const reporter = new CSPReporter("https://example.com/report");

      const result = await reporter.send([]);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends reports to endpoint", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockFetch.mockResolvedValue({ ok: true });

      const result = await reporter.send(reports);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/report",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.any(String),
        }
      );
    });

    it("includes correct payload structure", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockFetch.mockResolvedValue({ ok: true });

      await reporter.send(reports);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body) as ReportPayload;

      expect(body.reports).toEqual(reports);
      expect(body.metadata.extensionVersion).toBe("1.0.0");
      expect(body.metadata.userAgent).toBe("Mozilla/5.0 (Test Agent)");
      expect(body.metadata.timestamp).toBeDefined();
    });

    it("returns false when server returns error", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await reporter.send(reports);

      expect(result).toBe(false);
    });

    it("sends multiple reports at once", async () => {
      const reporter = new CSPReporter("https://example.com/report");
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
      mockFetch.mockResolvedValue({ ok: true });

      const result = await reporter.send(reports);

      expect(result).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body) as ReportPayload;
      expect(body.reports).toHaveLength(2);
    });
  });

  describe("retry mechanism", () => {
    it("retries on network failure", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      // Fail first two times, succeed on third
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true });

      const sendPromise = reporter.send(reports);

      // Advance through retry delays (1s, 2s exponential backoff)
      await vi.advanceTimersByTimeAsync(1000); // First retry
      await vi.advanceTimersByTimeAsync(2000); // Second retry

      const result = await sendPromise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("returns false after max retries exceeded", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      // Always fail
      mockFetch.mockRejectedValue(new Error("Network error"));

      const sendPromise = reporter.send(reports);

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(1000); // First retry
      await vi.advanceTimersByTimeAsync(2000); // Second retry
      await vi.advanceTimersByTimeAsync(4000); // Third retry

      const result = await sendPromise;

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("uses exponential backoff for retries", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true });

      const sendPromise = reporter.send(reports);

      // Should not have retried yet
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance partial time - not enough for retry
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance to complete first retry delay (1000ms base * 2^0 = 1000ms)
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const result = await sendPromise;
      expect(result).toBe(true);
    });
  });

  describe("setEndpoint", () => {
    it("changes the endpoint", async () => {
      const reporter = new CSPReporter("https://old.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockFetch.mockResolvedValue({ ok: true });

      reporter.setEndpoint("https://new.com/report");
      await reporter.send(reports);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://new.com/report",
        expect.any(Object)
      );
    });

    it("can disable reporting by setting null", async () => {
      const reporter = new CSPReporter("https://example.com/report");
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];

      reporter.setEndpoint(null);
      const result = await reporter.send(reports);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("can re-enable reporting after disabling", async () => {
      const reporter = new CSPReporter(null);
      const reports: CSPReport[] = [
        {
          id: "r1",
          domain: "example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          violations: [],
          requests: [],
        },
      ];
      mockFetch.mockResolvedValue({ ok: true });

      // Initially disabled
      let result = await reporter.send(reports);
      expect(result).toBe(false);

      // Enable
      reporter.setEndpoint("https://example.com/report");
      result = await reporter.send(reports);
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
