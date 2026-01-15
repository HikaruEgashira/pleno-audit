import { describe, it, expect } from "vitest";
import { QueryEngine } from "./query-engine.js";
import type { DynamicIndex } from "./types.js";

function createMockIndex(): DynamicIndex {
  return {
    period: { since: 0, until: Date.now() },
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
    createdAt: Date.now(),
    expiresAt: Date.now() + 300000,
  };
}

function createViolationRecord(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: "2024-01-15T10:00:00.000Z",
    pageUrl: "https://example.com/page",
    directive: "script-src",
    blockedURL: "https://evil.com/script.js",
    domain: "example.com",
    disposition: "enforce",
    ...overrides,
  };
}

function createNetworkRequestRecord(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: "2024-01-15T10:00:00.000Z",
    pageUrl: "https://example.com/page",
    url: "https://api.example.com/data",
    method: "GET",
    initiator: "fetch",
    domain: "example.com",
    resourceType: "xhr",
    ...overrides,
  };
}

function createEventRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    type: "login",
    domain: "example.com",
    timestamp: Date.UTC(2024, 0, 15, 10, 0, 0),
    details: "{}",
    ...overrides,
  };
}

describe("QueryEngine", () => {
  describe("queryReports", () => {
    it("combines violations and requests", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [createViolationRecord()];
      const requests = [createNetworkRequestRecord()];

      const result = engine.queryReports(violations, requests, index);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty result for no data", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();

      const result = engine.queryReports([], [], index);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("filters by domain", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ domain: "example.com" }),
        createViolationRecord({ domain: "other.com" }),
      ];
      const requests = [
        createNetworkRequestRecord({ domain: "example.com" }),
        createNetworkRequestRecord({ domain: "other.com" }),
      ];

      const result = engine.queryReports(violations, requests, index, { domain: "example.com" });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((r) => r.domain === "example.com")).toBe(true);
    });

    it("filters by since time", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryReports(violations, [], index, { since: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].timestamp).toBe("2024-01-20T00:00:00.000Z");
    });

    it("filters by until time", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryReports(violations, [], index, { until: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].timestamp).toBe("2024-01-10T00:00:00.000Z");
    });

    it("filters by time range", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-05T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-15T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-25T00:00:00.000Z" }),
      ];

      const result = engine.queryReports(violations, [], index, {
        since: "2024-01-10T00:00:00.000Z",
        until: "2024-01-20T00:00:00.000Z",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].timestamp).toBe("2024-01-15T00:00:00.000Z");
    });

    it("sorts by timestamp descending", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-15T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-05T00:00:00.000Z" }),
      ];

      const result = engine.queryReports(violations, [], index);

      expect(result.data[0].timestamp).toBe("2024-01-15T00:00:00.000Z");
      expect(result.data[1].timestamp).toBe("2024-01-10T00:00:00.000Z");
      expect(result.data[2].timestamp).toBe("2024-01-05T00:00:00.000Z");
    });

    it("applies pagination with limit", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-01T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-02T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-03T00:00:00.000Z" }),
      ];

      const result = engine.queryReports(violations, [], index, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it("applies pagination with offset", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-01T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-02T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-03T00:00:00.000Z" }),
      ];

      const result = engine.queryReports(violations, [], index, { offset: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it("uses default limit of 50", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = Array.from({ length: 60 }, (_, i) =>
        createViolationRecord({ timestamp: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` })
      );

      const result = engine.queryReports(violations, [], index);

      expect(result.data).toHaveLength(50);
      expect(result.total).toBe(60);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("queryViolations", () => {
    it("returns all violations", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ directive: "script-src" }),
        createViolationRecord({ directive: "style-src" }),
      ];

      const result = engine.queryViolations(violations, index);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].type).toBe("csp-violation");
    });

    it("filters by domain", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ domain: "example.com" }),
        createViolationRecord({ domain: "other.com" }),
      ];

      const result = engine.queryViolations(violations, index, { domain: "example.com" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].domain).toBe("example.com");
    });

    it("filters by since time", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryViolations(violations, index, { since: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
    });

    it("filters by until time", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryViolations(violations, index, { until: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
    });

    it("sorts by timestamp descending", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryViolations(violations, index);

      expect(result.data[0].timestamp).toBe("2024-01-20T00:00:00.000Z");
      expect(result.data[1].timestamp).toBe("2024-01-10T00:00:00.000Z");
    });

    it("applies pagination", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [
        createViolationRecord({ timestamp: "2024-01-01T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-02T00:00:00.000Z" }),
        createViolationRecord({ timestamp: "2024-01-03T00:00:00.000Z" }),
      ];

      const result = engine.queryViolations(violations, index, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("queryNetworkRequests", () => {
    it("returns all network requests", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const requests = [
        createNetworkRequestRecord({ method: "GET" }),
        createNetworkRequestRecord({ method: "POST" }),
      ];

      const result = engine.queryNetworkRequests(requests, index);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].type).toBe("network-request");
    });

    it("filters by domain", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const requests = [
        createNetworkRequestRecord({ domain: "example.com" }),
        createNetworkRequestRecord({ domain: "other.com" }),
      ];

      const result = engine.queryNetworkRequests(requests, index, { domain: "example.com" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].domain).toBe("example.com");
    });

    it("filters by since time", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const requests = [
        createNetworkRequestRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createNetworkRequestRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryNetworkRequests(requests, index, { since: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
    });

    it("filters by until time", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const requests = [
        createNetworkRequestRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createNetworkRequestRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryNetworkRequests(requests, index, { until: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
    });

    it("sorts by timestamp descending", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const requests = [
        createNetworkRequestRecord({ timestamp: "2024-01-10T00:00:00.000Z" }),
        createNetworkRequestRecord({ timestamp: "2024-01-20T00:00:00.000Z" }),
      ];

      const result = engine.queryNetworkRequests(requests, index);

      expect(result.data[0].timestamp).toBe("2024-01-20T00:00:00.000Z");
      expect(result.data[1].timestamp).toBe("2024-01-10T00:00:00.000Z");
    });

    it("applies pagination", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const requests = [
        createNetworkRequestRecord({ timestamp: "2024-01-01T00:00:00.000Z" }),
        createNetworkRequestRecord({ timestamp: "2024-01-02T00:00:00.000Z" }),
        createNetworkRequestRecord({ timestamp: "2024-01-03T00:00:00.000Z" }),
      ];

      const result = engine.queryNetworkRequests(requests, index, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("queryEvents", () => {
    it("returns all events", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ type: "login" }),
        createEventRecord({ id: "event-2", type: "ai_prompt" }),
      ];

      const result = engine.queryEvents(events, index);

      expect(result.data).toHaveLength(2);
    });

    it("filters by type", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ type: "login" }),
        createEventRecord({ id: "event-2", type: "ai_prompt" }),
      ];

      const result = engine.queryEvents(events, index, { type: "login" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe("login");
    });

    it("filters by domain", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ domain: "example.com" }),
        createEventRecord({ id: "event-2", domain: "other.com" }),
      ];

      const result = engine.queryEvents(events, index, { domain: "example.com" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].domain).toBe("example.com");
    });

    it("filters by since time (string)", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ timestamp: Date.UTC(2024, 0, 10) }),
        createEventRecord({ id: "event-2", timestamp: Date.UTC(2024, 0, 20) }),
      ];

      const result = engine.queryEvents(events, index, { since: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("event-2");
    });

    it("filters by until time (string)", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ timestamp: Date.UTC(2024, 0, 10) }),
        createEventRecord({ id: "event-2", timestamp: Date.UTC(2024, 0, 20) }),
      ];

      const result = engine.queryEvents(events, index, { until: "2024-01-15T00:00:00.000Z" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("event-1");
    });

    it("sorts by timestamp descending", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ timestamp: Date.UTC(2024, 0, 10) }),
        createEventRecord({ id: "event-2", timestamp: Date.UTC(2024, 0, 20) }),
      ];

      const result = engine.queryEvents(events, index);

      expect(result.data[0].id).toBe("event-2");
      expect(result.data[1].id).toBe("event-1");
    });

    it("applies pagination", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ id: "event-1", timestamp: Date.UTC(2024, 0, 1) }),
        createEventRecord({ id: "event-2", timestamp: Date.UTC(2024, 0, 2) }),
        createEventRecord({ id: "event-3", timestamp: Date.UTC(2024, 0, 3) }),
      ];

      const result = engine.queryEvents(events, index, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it("handles combined type and domain filter", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const events = [
        createEventRecord({ id: "event-1", type: "login", domain: "example.com" }),
        createEventRecord({ id: "event-2", type: "login", domain: "other.com" }),
        createEventRecord({ id: "event-3", type: "ai_prompt", domain: "example.com" }),
      ];

      const result = engine.queryEvents(events, index, { type: "login", domain: "example.com" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("event-1");
    });
  });

  describe("getUniqueDomains", () => {
    it("returns unique domains from violations and requests", () => {
      const engine = new QueryEngine();
      const violations = [
        createViolationRecord({ domain: "a.com" }),
        createViolationRecord({ domain: "b.com" }),
      ];
      const requests = [
        createNetworkRequestRecord({ domain: "b.com" }),
        createNetworkRequestRecord({ domain: "c.com" }),
      ];

      const domains = engine.getUniqueDomains(violations, requests);

      expect(domains).toHaveLength(3);
      expect(domains).toContain("a.com");
      expect(domains).toContain("b.com");
      expect(domains).toContain("c.com");
    });

    it("returns empty array for no data", () => {
      const engine = new QueryEngine();

      const domains = engine.getUniqueDomains([], []);

      expect(domains).toHaveLength(0);
    });

    it("returns sorted domains", () => {
      const engine = new QueryEngine();
      const violations = [
        createViolationRecord({ domain: "z.com" }),
        createViolationRecord({ domain: "a.com" }),
      ];
      const requests = [
        createNetworkRequestRecord({ domain: "m.com" }),
      ];

      const domains = engine.getUniqueDomains(violations, requests);

      expect(domains).toEqual(["a.com", "m.com", "z.com"]);
    });

    it("deduplicates domains", () => {
      const engine = new QueryEngine();
      const violations = [
        createViolationRecord({ domain: "example.com" }),
        createViolationRecord({ domain: "example.com" }),
        createViolationRecord({ domain: "example.com" }),
      ];
      const requests = [
        createNetworkRequestRecord({ domain: "example.com" }),
        createNetworkRequestRecord({ domain: "example.com" }),
      ];

      const domains = engine.getUniqueDomains(violations, requests);

      expect(domains).toHaveLength(1);
      expect(domains[0]).toBe("example.com");
    });
  });

  describe("edge cases", () => {
    it("handles empty options object", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [createViolationRecord()];

      const result = engine.queryViolations(violations, index, {});

      expect(result.data).toHaveLength(1);
    });

    it("handles undefined options", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [createViolationRecord()];

      const result = engine.queryViolations(violations, index);

      expect(result.data).toHaveLength(1);
    });

    it("handles offset larger than data size", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [createViolationRecord()];

      const result = engine.queryViolations(violations, index, { offset: 100 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("handles zero limit", () => {
      const engine = new QueryEngine();
      const index = createMockIndex();
      const violations = [createViolationRecord()];

      const result = engine.queryViolations(violations, index, { limit: 0 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(true);
    });
  });
});
