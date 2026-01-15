import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WriteBuffer } from "./write-buffer.js";
import type { ParquetLogType } from "./types.js";

describe("WriteBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("creates a buffer instance", () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer(onFlush);

      expect(buffer).toBeDefined();
    });
  });

  describe("add", () => {
    it("adds records to buffer", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);

      expect(buffer.getBufferSize("events")).toBe(1);
    });

    it("adds multiple records at once", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }, { id: "2" }, { id: "3" }]);

      expect(buffer.getBufferSize("events")).toBe(3);
    });

    it("accumulates records across multiple adds", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.add("events", [{ id: "2" }]);
      await buffer.add("events", [{ id: "3" }]);

      expect(buffer.getBufferSize("events")).toBe(3);
    });

    it("handles different buffer types independently", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }, { id: "2" }]);
      await buffer.add("csp-violations", [{ id: "3" }]);

      expect(buffer.getBufferSize("events")).toBe(2);
      expect(buffer.getBufferSize("csp-violations")).toBe(1);
    });

    it("flushes when buffer reaches max size (100)", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      // Add 100 records to trigger auto-flush
      const records = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
      await buffer.add("events", records);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith("events", records, expect.any(String));
      expect(buffer.getBufferSize("events")).toBe(0);
    });

    it("sets up flush timer for debounce", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);

      expect(onFlush).not.toHaveBeenCalled();

      // Advance time by 5 seconds (flush interval)
      await vi.advanceTimersByTimeAsync(5000);

      expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it("resets timer on subsequent adds", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await vi.advanceTimersByTimeAsync(3000); // 3 seconds

      await buffer.add("events", [{ id: "2" }]);
      await vi.advanceTimersByTimeAsync(3000); // 3 more seconds (6 total from first add)

      expect(onFlush).not.toHaveBeenCalled();

      // Need 5 more seconds from second add
      await vi.advanceTimersByTimeAsync(2000);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(
        "events",
        [{ id: "1" }, { id: "2" }],
        expect.any(String)
      );
    });
  });

  describe("flush", () => {
    it("flushes buffer contents", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }, { id: "2" }]);
      await buffer.flush("events");

      expect(onFlush).toHaveBeenCalledWith(
        "events",
        [{ id: "1" }, { id: "2" }],
        expect.any(String)
      );
      expect(buffer.getBufferSize("events")).toBe(0);
    });

    it("does nothing for empty buffer", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.flush("events");

      expect(onFlush).not.toHaveBeenCalled();
    });

    it("does nothing for non-existent buffer type", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.flush("network-requests");

      expect(onFlush).not.toHaveBeenCalled();
    });

    it("clears pending timer on flush", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.flush("events");

      expect(onFlush).toHaveBeenCalledTimes(1);

      // Advance time - timer should have been cleared
      await vi.advanceTimersByTimeAsync(10000);

      expect(onFlush).toHaveBeenCalledTimes(1); // No additional flush
    });

    it("resets buffer for new records after flush", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.flush("events");
      await buffer.add("events", [{ id: "2" }]);
      await buffer.flush("events");

      expect(onFlush).toHaveBeenCalledTimes(2);
      expect(onFlush).toHaveBeenNthCalledWith(1, "events", [{ id: "1" }], expect.any(String));
      expect(onFlush).toHaveBeenNthCalledWith(2, "events", [{ id: "2" }], expect.any(String));
    });
  });

  describe("flushAll", () => {
    it("flushes all buffer types", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.add("csp-violations", [{ id: "2" }]);
      await buffer.add("network-requests", [{ id: "3" }]);

      await buffer.flushAll();

      expect(onFlush).toHaveBeenCalledTimes(3);
    });

    it("handles empty buffers", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.flushAll();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it("flushes all concurrently", async () => {
      const flushOrder: string[] = [];
      const onFlush = vi.fn().mockImplementation(async (type: ParquetLogType) => {
        flushOrder.push(type);
      });
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.add("csp-violations", [{ id: "2" }]);

      await buffer.flushAll();

      expect(flushOrder).toHaveLength(2);
      expect(flushOrder).toContain("events");
      expect(flushOrder).toContain("csp-violations");
    });
  });

  describe("getBufferSize", () => {
    it("returns 0 for non-existent buffer", () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      expect(buffer.getBufferSize("events")).toBe(0);
    });

    it("returns correct size after adds", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      expect(buffer.getBufferSize("events")).toBe(1);

      await buffer.add("events", [{ id: "2" }, { id: "3" }]);
      expect(buffer.getBufferSize("events")).toBe(3);
    });

    it("returns 0 after flush", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.flush("events");

      expect(buffer.getBufferSize("events")).toBe(0);
    });
  });

  describe("clearBuffer", () => {
    it("clears buffer contents", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }, { id: "2" }]);
      buffer.clearBuffer("events");

      expect(buffer.getBufferSize("events")).toBe(0);
    });

    it("clears pending timer", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      buffer.clearBuffer("events");

      await vi.advanceTimersByTimeAsync(10000);

      expect(onFlush).not.toHaveBeenCalled();
    });

    it("handles non-existent buffer", () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      // Should not throw
      expect(() => buffer.clearBuffer("events")).not.toThrow();
    });

    it("allows adding after clear", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      buffer.clearBuffer("events");
      await buffer.add("events", [{ id: "2" }]);

      expect(buffer.getBufferSize("events")).toBe(1);
    });
  });

  describe("date handling", () => {
    it("passes date string to flush callback", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);
      await buffer.flush("events");

      expect(onFlush).toHaveBeenCalledWith(
        "events",
        expect.any(Array),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });
  });

  describe("concurrent operations", () => {
    it("handles concurrent adds", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await Promise.all([
        buffer.add("events", [{ id: "1" }]),
        buffer.add("events", [{ id: "2" }]),
        buffer.add("events", [{ id: "3" }]),
      ]);

      expect(buffer.getBufferSize("events")).toBe(3);
    });

    it("handles concurrent adds to different types", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await Promise.all([
        buffer.add("events", [{ id: "1" }]),
        buffer.add("csp-violations", [{ id: "2" }]),
        buffer.add("network-requests", [{ id: "3" }]),
      ]);

      expect(buffer.getBufferSize("events")).toBe(1);
      expect(buffer.getBufferSize("csp-violations")).toBe(1);
      expect(buffer.getBufferSize("network-requests")).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("handles empty record array", async () => {
      const onFlush = vi.fn();
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", []);

      expect(buffer.getBufferSize("events")).toBe(0);
    });

    it("handles flush error gracefully", async () => {
      const onFlush = vi.fn().mockRejectedValue(new Error("Flush failed"));
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      await buffer.add("events", [{ id: "1" }]);

      await expect(buffer.flush("events")).rejects.toThrow("Flush failed");
    });

    it("handles exactly max buffer size", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      // Add exactly 100 records
      const records = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
      await buffer.add("events", records);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(buffer.getBufferSize("events")).toBe(0);
    });

    it("handles just under max buffer size", async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const buffer = new WriteBuffer<{ id: string }>(onFlush);

      // Add 99 records (just under max)
      const records = Array.from({ length: 99 }, (_, i) => ({ id: String(i) }));
      await buffer.add("events", records);

      expect(onFlush).not.toHaveBeenCalled();
      expect(buffer.getBufferSize("events")).toBe(99);

      // Add one more to trigger flush
      await buffer.add("events", [{ id: "99" }]);

      expect(onFlush).toHaveBeenCalledTimes(1);
    });
  });
});
