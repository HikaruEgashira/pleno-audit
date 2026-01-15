import { describe, it, expect, vi } from "vitest";
import {
  createPermissionAnalyzer,
  createInMemoryPermissionStore,
  type ExtensionManifest,
} from "./analyzer.js";

function createTestManifest(overrides: Partial<ExtensionManifest> = {}): ExtensionManifest {
  return {
    id: "test-extension",
    name: "Test Extension",
    version: "1.0.0",
    permissions: [],
    optional_permissions: [],
    host_permissions: [],
    ...overrides,
  };
}

describe("createInMemoryPermissionStore", () => {
  it("stores and retrieves baseline", async () => {
    const store = createInMemoryPermissionStore();

    await store.saveBaseline({
      extensionId: "test",
      baselinePermissions: ["tabs"],
      baselineHosts: [],
      createdAt: Date.now(),
    });

    const baseline = await store.getBaseline("test");
    expect(baseline?.extensionId).toBe("test");
    expect(baseline?.baselinePermissions).toContain("tabs");
  });

  it("returns null for non-existent baseline", async () => {
    const store = createInMemoryPermissionStore();
    expect(await store.getBaseline("non-existent")).toBeNull();
  });

  it("stores and retrieves analysis", async () => {
    const store = createInMemoryPermissionStore();

    await store.saveAnalysis({
      id: "test-ext",
      name: "Test",
      version: "1.0",
      permissions: [],
      hostPermissions: [],
      riskScore: 0,
      riskLevel: "minimal",
      findings: [],
      recommendations: [],
      analyzedAt: Date.now(),
    });

    const analysis = await store.getAnalysis("test-ext");
    expect(analysis?.id).toBe("test-ext");
  });

  it("returns all analyses", async () => {
    const store = createInMemoryPermissionStore();

    await store.saveAnalysis({
      id: "ext1",
      name: "Extension 1",
      version: "1.0",
      permissions: [],
      hostPermissions: [],
      riskScore: 0,
      riskLevel: "minimal",
      findings: [],
      recommendations: [],
      analyzedAt: Date.now(),
    });

    await store.saveAnalysis({
      id: "ext2",
      name: "Extension 2",
      version: "1.0",
      permissions: [],
      hostPermissions: [],
      riskScore: 0,
      riskLevel: "minimal",
      findings: [],
      recommendations: [],
      analyzedAt: Date.now(),
    });

    const all = await store.getAllAnalyses();
    expect(all.length).toBe(2);
  });
});

describe("createPermissionAnalyzer", () => {
  describe("analyzeExtension", () => {
    it("analyzes minimal extension", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest();
      const result = analyzer.analyzeExtension(manifest);

      expect(result.id).toBe("test-extension");
      expect(result.name).toBe("Test Extension");
      expect(result.permissions).toHaveLength(0);
      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe("minimal");
    });

    it("detects tabs permission", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({ permissions: ["tabs"] });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "tabs")).toBe(true);
    });

    it("detects storage permission", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({ permissions: ["storage"] });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "storage")).toBe(true);
    });

    it("detects cookies permission", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({ permissions: ["cookies"] });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "cookies")).toBe(true);
    });

    it("detects webRequest permission", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({ permissions: ["webRequest"] });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "webRequest")).toBe(true);
    });

    it("detects all_urls pattern", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        host_permissions: ["<all_urls>"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "all_urls")).toBe(true);
      expect(result.hostPermissions).toContain("<all_urls>");
    });

    it("detects wildcard host pattern", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        host_permissions: ["*://*/*"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "all_urls")).toBe(true);
    });

    it("categorizes host permissions", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        host_permissions: ["https://example.com/*"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.hostPermissions).toContain("https://example.com/*");
    });

    it("handles unknown permissions", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["customPermission"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.permissions.some((p) => p.type === "unknown")).toBe(true);
    });
  });

  describe("risk scoring", () => {
    it("assigns low risk for minimal permissions", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({ permissions: ["storage"] });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.riskScore).toBeLessThan(20);
      expect(result.riskLevel).toBe("minimal");
    });

    it("assigns higher risk for more permissions", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["tabs", "cookies", "history", "webRequest"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.riskScore).toBeGreaterThan(20);
    });

    it("assigns critical risk for dangerous permissions", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["webRequestBlocking", "identity"],
        host_permissions: ["<all_urls>"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.riskLevel).toBe("critical");
    });
  });

  describe("findings", () => {
    it("generates finding for all_urls access", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        host_permissions: ["<all_urls>"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.findings.some((f) => f.type === "all_urls_access")).toBe(true);
    });

    it("generates finding for history access", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["history"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.findings.some((f) => f.type === "history_access")).toBe(true);
    });

    it("generates finding for identity access", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["identity"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.findings.some((f) => f.type === "identity_access")).toBe(true);
    });

    it("generates finding for webRequestBlocking", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["webRequestBlocking"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.findings.some((f) => f.type === "blocking_capability")).toBe(true);
    });

    it("detects dangerous combinations", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: ["webRequest", "cookies"],
        host_permissions: ["<all_urls>"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.findings.some((f) => f.type === "dangerous_combination")).toBe(true);
    });
  });

  describe("recommendations", () => {
    it("recommends limiting all_urls", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        host_permissions: ["<all_urls>"],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.recommendations.some((r) => r.includes("all_urls"))).toBe(true);
    });

    it("recommends reducing permissions when many granted", () => {
      const analyzer = createPermissionAnalyzer();
      const manifest = createTestManifest({
        permissions: [
          "tabs", "cookies", "storage", "history", "bookmarks",
          "downloads", "notifications", "webRequest", "privacy", "proxy",
          "clipboardRead",
        ],
      });
      const result = analyzer.analyzeExtension(manifest);

      expect(result.recommendations.some((r) => r.includes("reducing"))).toBe(true);
    });
  });

  describe("compareWithBaseline", () => {
    it("detects added permissions", () => {
      const analyzer = createPermissionAnalyzer();

      const baseline = {
        extensionId: "test",
        extensionName: "Test",
        baselinePermissions: ["storage" as const],
        baselineHosts: [],
        createdAt: Date.now(),
      };

      const manifest = createTestManifest({
        permissions: ["storage", "tabs"],
      });
      const analysis = analyzer.analyzeExtension(manifest);
      const changes = analyzer.compareWithBaseline(analysis, baseline);

      expect(changes.some((c) => c.changeType === "added" && c.permission === "tabs")).toBe(true);
    });

    it("detects removed permissions", () => {
      const analyzer = createPermissionAnalyzer();

      const baseline = {
        extensionId: "test",
        extensionName: "Test",
        baselinePermissions: ["storage" as const, "tabs" as const],
        baselineHosts: [],
        createdAt: Date.now(),
      };

      const manifest = createTestManifest({
        permissions: ["storage"],
      });
      const analysis = analyzer.analyzeExtension(manifest);
      const changes = analyzer.compareWithBaseline(analysis, baseline);

      expect(changes.some((c) => c.changeType === "removed" && c.permission === "tabs")).toBe(true);
    });

    it("detects added host permissions", () => {
      const analyzer = createPermissionAnalyzer();

      const baseline = {
        extensionId: "test",
        extensionName: "Test",
        baselinePermissions: [],
        baselineHosts: [],
        createdAt: Date.now(),
      };

      const manifest = createTestManifest({
        host_permissions: ["https://example.com/*"],
      });
      const analysis = analyzer.analyzeExtension(manifest);
      const changes = analyzer.compareWithBaseline(analysis, baseline);

      expect(changes.some((c) => c.changeType === "added" && c.permission.startsWith("host:"))).toBe(true);
    });

    it("assigns higher risk for wildcard host additions", () => {
      const analyzer = createPermissionAnalyzer();

      const baseline = {
        extensionId: "test",
        extensionName: "Test",
        baselinePermissions: [],
        baselineHosts: [],
        createdAt: Date.now(),
      };

      const manifest = createTestManifest({
        host_permissions: ["*://*.example.com/*"],
      });
      const analysis = analyzer.analyzeExtension(manifest);
      const changes = analyzer.compareWithBaseline(analysis, baseline);

      const hostChange = changes.find((c) => c.permission.startsWith("host:"));
      expect(hostChange?.risk).toBe("high");
    });
  });

  describe("subscribe", () => {
    it("notifies listener on permission changes", () => {
      const analyzer = createPermissionAnalyzer();
      const listener = vi.fn();

      const unsubscribe = analyzer.subscribe(listener);

      const baseline = {
        extensionId: "test",
        extensionName: "Test",
        baselinePermissions: [],
        baselineHosts: [],
        createdAt: Date.now(),
      };

      const manifest = createTestManifest({ permissions: ["tabs"] });
      const analysis = analyzer.analyzeExtension(manifest);
      analyzer.compareWithBaseline(analysis, baseline);

      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it("unsubscribe stops notifications", () => {
      const analyzer = createPermissionAnalyzer();
      const listener = vi.fn();

      const unsubscribe = analyzer.subscribe(listener);
      unsubscribe();

      const baseline = {
        extensionId: "test",
        extensionName: "Test",
        baselinePermissions: [],
        baselineHosts: [],
        createdAt: Date.now(),
      };

      const manifest = createTestManifest({ permissions: ["tabs"] });
      const analysis = analyzer.analyzeExtension(manifest);
      analyzer.compareWithBaseline(analysis, baseline);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("getSummary", () => {
    it("returns empty summary when no analyses", async () => {
      const analyzer = createPermissionAnalyzer();
      const summary = await analyzer.getSummary();

      expect(summary.totalExtensions).toBe(0);
      expect(summary.totalPermissions).toBe(0);
    });

    it("calculates summary from analyses", async () => {
      const store = createInMemoryPermissionStore();
      const analyzer = createPermissionAnalyzer(store);

      // Analyze some extensions
      analyzer.analyzeExtension(createTestManifest({
        id: "ext1",
        permissions: ["tabs", "storage"],
      }));

      analyzer.analyzeExtension(createTestManifest({
        id: "ext2",
        permissions: ["cookies", "history"],
      }));

      const summary = await analyzer.getSummary();

      expect(summary.totalExtensions).toBe(2);
      expect(summary.totalPermissions).toBeGreaterThan(0);
    });
  });
});
