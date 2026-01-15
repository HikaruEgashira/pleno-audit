import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DynamicIndexCache, DynamicIndexBuilder } from "./dynamic-index.js";
import type { DynamicIndex } from "./types.js";

function createMockIndex(overrides: Partial<DynamicIndex> = {}): DynamicIndex {
  const now = Date.now();
  return {
    period: { since: now - 3600000, until: now },
    tables: {
      cspViolations: new Map(),
      networkRequests: new Map(),
      events: new Map(),
    },
    stats: {
      totalRecords: 0,
      byType: {},
      byDomain: {},
    },
    createdAt: now,
    expiresAt: now + 300000, // 5 minutes from now
    ...overrides,
  };
}

describe("DynamicIndexCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("get", () => {
    it("returns null for non-existent key", () => {
      const cache = new DynamicIndexCache();

      const result = cache.get(1000, 2000);

      expect(result).toBeNull();
    });

    it("returns cached index", () => {
      const cache = new DynamicIndexCache();
      const index = createMockIndex({
        period: { since: 1000, until: 2000 },
      });

      cache.set(index);
      const result = cache.get(1000, 2000);

      expect(result).not.toBeNull();
      expect(result?.period.since).toBe(1000);
      expect(result?.period.until).toBe(2000);
    });

    it("returns null for expired index", () => {
      const cache = new DynamicIndexCache();
      const now = Date.now();
      const index = createMockIndex({
        period: { since: 1000, until: 2000 },
        expiresAt: now + 60000, // 1 minute
      });

      cache.set(index);

      // Advance time past expiration
      vi.advanceTimersByTime(70000);

      const result = cache.get(1000, 2000);

      expect(result).toBeNull();
    });

    it("removes expired index from cache", () => {
      const cache = new DynamicIndexCache();
      const now = Date.now();
      const index = createMockIndex({
        period: { since: 1000, until: 2000 },
        expiresAt: now + 60000,
      });

      cache.set(index);

      vi.advanceTimersByTime(70000);
      cache.get(1000, 2000);

      // Re-set and check it works
      const newIndex = createMockIndex({
        period: { since: 1000, until: 2000 },
        expiresAt: Date.now() + 300000,
      });
      cache.set(newIndex);
      const result = cache.get(1000, 2000);

      expect(result).not.toBeNull();
    });
  });

  describe("set", () => {
    it("stores index in cache", () => {
      const cache = new DynamicIndexCache();
      const index = createMockIndex({
        period: { since: 1000, until: 2000 },
      });

      cache.set(index);

      expect(cache.get(1000, 2000)).not.toBeNull();
    });

    it("overwrites existing index with same key", () => {
      const cache = new DynamicIndexCache();
      const index1 = createMockIndex({
        period: { since: 1000, until: 2000 },
        stats: { totalRecords: 10, byType: {}, byDomain: {} },
      });
      const index2 = createMockIndex({
        period: { since: 1000, until: 2000 },
        stats: { totalRecords: 20, byType: {}, byDomain: {} },
      });

      cache.set(index1);
      cache.set(index2);

      const result = cache.get(1000, 2000);
      expect(result?.stats.totalRecords).toBe(20);
    });

    it("limits cache to 3 entries", () => {
      const cache = new DynamicIndexCache();

      // Add 4 indexes with different time periods
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(1);
        const index = createMockIndex({
          period: { since: i * 1000, until: (i + 1) * 1000 },
          createdAt: Date.now(),
        });
        cache.set(index);
      }

      // The oldest entry (0-1000) should have been removed
      expect(cache.get(0, 1000)).toBeNull();

      // The newer entries should still exist
      expect(cache.get(1000, 2000)).not.toBeNull();
      expect(cache.get(2000, 3000)).not.toBeNull();
      expect(cache.get(3000, 4000)).not.toBeNull();
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      const cache = new DynamicIndexCache();

      cache.set(createMockIndex({ period: { since: 1000, until: 2000 } }));
      cache.set(createMockIndex({ period: { since: 2000, until: 3000 } }));

      cache.clear();

      expect(cache.get(1000, 2000)).toBeNull();
      expect(cache.get(2000, 3000)).toBeNull();
    });

    it("handles empty cache", () => {
      const cache = new DynamicIndexCache();

      expect(() => cache.clear()).not.toThrow();
    });
  });
});

describe("DynamicIndexBuilder", () => {
  describe("buildIndex", () => {
    it("builds empty index", () => {
      const builder = new DynamicIndexBuilder();

      const index = builder.buildIndex([], [], [], 1000, 2000);

      expect(index.period.since).toBe(1000);
      expect(index.period.until).toBe(2000);
      expect(index.stats.totalRecords).toBe(0);
      expect(index.tables.cspViolations.size).toBe(0);
      expect(index.tables.networkRequests.size).toBe(0);
      expect(index.tables.events.size).toBe(0);
    });

    it("indexes CSP violations by domain", () => {
      const builder = new DynamicIndexBuilder();
      const violations = [
        { domain: "a.com", directive: "script-src" },
        { domain: "a.com", directive: "style-src" },
        { domain: "b.com", directive: "script-src" },
      ];

      const index = builder.buildIndex(violations, [], [], 1000, 2000);

      expect(index.tables.cspViolations.size).toBe(2);
      expect(index.tables.cspViolations.get("a.com")).toEqual([0, 1]);
      expect(index.tables.cspViolations.get("b.com")).toEqual([2]);
    });

    it("indexes network requests by domain", () => {
      const builder = new DynamicIndexBuilder();
      const requests = [
        { domain: "api.com", method: "GET" },
        { domain: "api.com", method: "POST" },
        { domain: "cdn.com", method: "GET" },
      ];

      const index = builder.buildIndex([], requests, [], 1000, 2000);

      expect(index.tables.networkRequests.size).toBe(2);
      expect(index.tables.networkRequests.get("api.com")).toEqual([0, 1]);
      expect(index.tables.networkRequests.get("cdn.com")).toEqual([2]);
    });

    it("indexes events by type", () => {
      const builder = new DynamicIndexBuilder();
      const events = [
        { type: "login", domain: "a.com" },
        { type: "login", domain: "b.com" },
        { type: "ai_prompt", domain: "c.com" },
      ];

      const index = builder.buildIndex([], [], events, 1000, 2000);

      expect(index.tables.events.size).toBe(2);
      expect(index.tables.events.get("login")).toEqual([0, 1]);
      expect(index.tables.events.get("ai_prompt")).toEqual([2]);
    });

    it("calculates total records correctly", () => {
      const builder = new DynamicIndexBuilder();
      const violations = [{ domain: "a.com" }];
      const requests = [{ domain: "b.com" }, { domain: "c.com" }];
      const events = [{ type: "login" }, { type: "login" }, { type: "login" }];

      const index = builder.buildIndex(violations, requests, events, 1000, 2000);

      expect(index.stats.totalRecords).toBe(6);
    });

    it("calculates byType stats correctly", () => {
      const builder = new DynamicIndexBuilder();
      const violations = [{ domain: "a.com" }, { domain: "b.com" }];
      const requests = [{ domain: "c.com" }];
      const events = [{ type: "login" }, { type: "login" }, { type: "login" }];

      const index = builder.buildIndex(violations, requests, events, 1000, 2000);

      expect(index.stats.byType["csp-violations"]).toBe(2);
      expect(index.stats.byType["network-requests"]).toBe(1);
      expect(index.stats.byType["events"]).toBe(3);
    });

    it("calculates byDomain stats correctly", () => {
      const builder = new DynamicIndexBuilder();
      const violations = [{ domain: "a.com" }, { domain: "a.com" }];
      const requests = [{ domain: "a.com" }, { domain: "b.com" }];
      const events: Record<string, unknown>[] = [];

      const index = builder.buildIndex(violations, requests, events, 1000, 2000);

      expect(index.stats.byDomain["a.com"]).toBe(3);
      expect(index.stats.byDomain["b.com"]).toBe(1);
    });

    it("sets expiration time 5 minutes from now", () => {
      const builder = new DynamicIndexBuilder();
      const now = Date.now();

      const index = builder.buildIndex([], [], [], 1000, 2000);

      expect(index.createdAt).toBeGreaterThanOrEqual(now);
      expect(index.expiresAt).toBeGreaterThan(index.createdAt);
      expect(index.expiresAt - index.createdAt).toBe(5 * 60 * 1000);
    });

    it("handles mixed data types", () => {
      const builder = new DynamicIndexBuilder();
      const violations = [
        { domain: "example.com", directive: "script-src", blockedURL: "https://evil.com" },
      ];
      const requests = [
        { domain: "example.com", url: "https://api.example.com", method: "GET" },
      ];
      const events = [
        { type: "login", domain: "example.com", timestamp: Date.now() },
      ];

      const index = builder.buildIndex(violations, requests, events, 1000, 2000);

      expect(index.stats.totalRecords).toBe(3);
      expect(index.stats.byDomain["example.com"]).toBe(2); // violations + requests
    });

    it("handles single domain with multiple record types", () => {
      const builder = new DynamicIndexBuilder();
      const domain = "test.com";
      const violations = Array.from({ length: 5 }, () => ({ domain }));
      const requests = Array.from({ length: 3 }, () => ({ domain }));

      const index = builder.buildIndex(violations, requests, [], 1000, 2000);

      expect(index.stats.byDomain[domain]).toBe(8);
      expect(index.tables.cspViolations.get(domain)?.length).toBe(5);
      expect(index.tables.networkRequests.get(domain)?.length).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("handles large number of records", () => {
      const builder = new DynamicIndexBuilder();
      const violations = Array.from({ length: 1000 }, (_, i) => ({
        domain: `domain${i % 10}.com`,
      }));

      const index = builder.buildIndex(violations, [], [], 1000, 2000);

      expect(index.stats.totalRecords).toBe(1000);
      expect(index.tables.cspViolations.size).toBe(10);
    });

    it("handles records with same domain", () => {
      const builder = new DynamicIndexBuilder();
      const violations = Array.from({ length: 100 }, () => ({ domain: "same.com" }));

      const index = builder.buildIndex(violations, [], [], 1000, 2000);

      expect(index.tables.cspViolations.size).toBe(1);
      expect(index.tables.cspViolations.get("same.com")?.length).toBe(100);
    });

    it("preserves record order in indices", () => {
      const builder = new DynamicIndexBuilder();
      const violations = [
        { domain: "a.com", id: 0 },
        { domain: "a.com", id: 1 },
        { domain: "a.com", id: 2 },
      ];

      const index = builder.buildIndex(violations, [], [], 1000, 2000);

      expect(index.tables.cspViolations.get("a.com")).toEqual([0, 1, 2]);
    });
  });
});
