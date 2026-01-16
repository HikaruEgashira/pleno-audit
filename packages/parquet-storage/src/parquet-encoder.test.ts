import { describe, it, expect } from "vitest";
import {
  encodeToParquet,
  decodeFromParquet,
  getArrowSchema,
  decodeFromParquetWithColumns,
  isParquetWasmAvailable,
} from "./parquet-encoder";

describe("parquet-encoder", () => {
  describe("getArrowSchema", () => {
    it("returns schema for csp-violations", () => {
      const schema = getArrowSchema("csp-violations");
      expect(schema).toBeDefined();
      expect(schema?.length).toBeGreaterThan(0);
      expect(schema?.find((f) => f.name === "domain")).toBeDefined();
    });

    it("returns schema for network-requests", () => {
      const schema = getArrowSchema("network-requests");
      expect(schema).toBeDefined();
      expect(schema?.find((f) => f.name === "url")).toBeDefined();
    });

    it("returns schema for events", () => {
      const schema = getArrowSchema("events");
      expect(schema).toBeDefined();
      expect(schema?.find((f) => f.name === "timestamp")).toBeDefined();
    });

    it("returns undefined for unknown type", () => {
      const schema = getArrowSchema("unknown-type" as any);
      expect(schema).toBeUndefined();
    });
  });

  describe("encodeToParquet", () => {
    it("returns empty array for empty records", async () => {
      const result = await encodeToParquet("csp-violations", []);
      expect(result.length).toBe(0);
    });

    it("encodes records to Arrow IPC format", async () => {
      const records = [
        {
          timestamp: "2024-01-01T00:00:00.000Z",
          pageUrl: "https://example.com",
          directive: "script-src",
          blockedURL: "https://bad.com/script.js",
          domain: "example.com",
        },
      ];

      const result = await encodeToParquet("csp-violations", records);
      expect(result.length).toBeGreaterThan(0);
      // Arrow IPC stream format - continuation indicator (0xFFFFFFFF)
      expect(result[0]).toBe(0xff);
      expect(result[1]).toBe(0xff);
      expect(result[2]).toBe(0xff);
      expect(result[3]).toBe(0xff);
    });
  });

  describe("decodeFromParquet", () => {
    it("returns empty array for empty data", async () => {
      const result = await decodeFromParquet(new Uint8Array(0));
      expect(result).toEqual([]);
    });
  });

  describe("round-trip encoding/decoding", () => {
    it("preserves csp-violation data through encode/decode cycle", async () => {
      const records = [
        {
          timestamp: "2024-01-01T00:00:00.000Z",
          pageUrl: "https://example.com",
          directive: "script-src",
          blockedURL: "https://cdn.example.com/script.js",
          domain: "example.com",
          disposition: "report",
          originalPolicy: "script-src 'self'",
          sourceFile: null,
          lineNumber: null,
          columnNumber: null,
          statusCode: null,
        },
      ];

      const encoded = await encodeToParquet("csp-violations", records);
      const decoded = await decodeFromParquet(encoded);

      expect(decoded.length).toBe(1);
      expect(decoded[0].domain).toBe("example.com");
      expect(decoded[0].directive).toBe("script-src");
    });

    it("preserves network-request data through encode/decode cycle", async () => {
      const records = [
        {
          timestamp: "2024-01-01T00:00:00.000Z",
          pageUrl: "https://example.com",
          url: "https://api.example.com/data",
          method: "GET",
          initiator: "script",
          domain: "api.example.com",
          resourceType: "fetch",
        },
      ];

      const encoded = await encodeToParquet("network-requests", records);
      const decoded = await decodeFromParquet(encoded);

      expect(decoded.length).toBe(1);
      expect(decoded[0].url).toBe("https://api.example.com/data");
      expect(decoded[0].method).toBe("GET");
    });

    it("preserves events data through encode/decode cycle", async () => {
      const records = [
        {
          id: "test-id-1",
          type: "page_visit",
          domain: "example.com",
          timestamp: 1704067200000,
          details: '{"path":"/"}',
        },
      ];

      const encoded = await encodeToParquet("events", records);
      const decoded = await decodeFromParquet(encoded);

      expect(decoded.length).toBe(1);
      expect(decoded[0].type).toBe("page_visit");
      expect(decoded[0].timestamp).toBe(1704067200000);
    });

    it("handles multiple records correctly", async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(2024, 0, 1, i % 24).toISOString(),
        pageUrl: `https://example${i}.com`,
        directive: "script-src",
        blockedURL: `https://bad${i}.com/script.js`,
        domain: `example${i}.com`,
        disposition: null,
        originalPolicy: null,
        sourceFile: null,
        lineNumber: null,
        columnNumber: null,
        statusCode: null,
      }));

      const encoded = await encodeToParquet("csp-violations", records);
      const decoded = await decodeFromParquet(encoded);

      expect(decoded.length).toBe(100);
    });
  });

  describe("decodeFromParquetWithColumns", () => {
    it("returns empty array for empty data", async () => {
      const result = await decodeFromParquetWithColumns(new Uint8Array(0), [
        "domain",
      ]);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty columns", async () => {
      const result = await decodeFromParquetWithColumns(new Uint8Array(0), []);
      expect(result).toEqual([]);
    });

    it("extracts specified columns from Parquet data", async () => {
      const records = [
        {
          timestamp: "2024-01-01T00:00:00.000Z",
          pageUrl: "https://example.com",
          url: "https://api.example.com/data",
          method: "GET",
          initiator: "script",
          domain: "example.com",
          resourceType: "fetch",
        },
      ];

      const encoded = await encodeToParquet("network-requests", records);
      const decoded = await decodeFromParquetWithColumns(encoded, ["domain", "method"]);

      expect(decoded.length).toBe(1);
      expect(decoded[0].domain).toBe("example.com");
      expect(decoded[0].method).toBe("GET");
    });
  });

  describe("isParquetWasmAvailable", () => {
    it("returns boolean indicating availability", async () => {
      const available = await isParquetWasmAvailable();
      expect(typeof available).toBe("boolean");
    });
  });
});
