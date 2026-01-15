import { describe, it, expect, vi } from "vitest";
import {
  createRuntimeProtector,
  createInMemoryRuntimeStore,
  type ThreatDetectionEvent,
} from "./detector.js";

describe("createInMemoryRuntimeStore", () => {
  it("stores and retrieves threats", async () => {
    const store = createInMemoryRuntimeStore();

    await store.saveThreat({
      id: "threat1",
      type: "phishing",
      severity: "high",
      status: "active",
      source: "nrd_detector",
      timestamp: Date.now(),
      domain: "test.com",
      title: "Test threat",
      description: "Test description",
      indicators: [],
      context: { riskFactors: [] },
      mitigationActions: [],
      timeline: [],
      relatedThreats: [],
      notes: [],
    });

    const threats = await store.getThreats();
    expect(threats).toHaveLength(1);
    expect(threats[0].id).toBe("threat1");
  });

  it("updates threats", async () => {
    const store = createInMemoryRuntimeStore();

    await store.saveThreat({
      id: "threat1",
      type: "phishing",
      severity: "high",
      status: "active",
      source: "nrd_detector",
      timestamp: Date.now(),
      domain: "test.com",
      title: "Test threat",
      description: "Test description",
      indicators: [],
      context: { riskFactors: [] },
      mitigationActions: [],
      timeline: [],
      relatedThreats: [],
      notes: [],
    });

    await store.updateThreat("threat1", { status: "resolved" });

    const threats = await store.getThreats();
    expect(threats[0].status).toBe("resolved");
  });

  it("stores and retrieves incidents", async () => {
    const store = createInMemoryRuntimeStore();

    await store.saveIncident({
      id: "incident1",
      title: "Test incident",
      severity: "high",
      status: "open",
      threats: ["threat1"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: "Summary",
      impact: "Impact",
      timeline: [],
      tags: [],
    });

    const incidents = await store.getIncidents();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].id).toBe("incident1");
  });

  it("sorts threats by timestamp descending", async () => {
    const store = createInMemoryRuntimeStore();
    const now = Date.now();

    await store.saveThreat({
      id: "old",
      type: "phishing",
      severity: "medium",
      status: "active",
      source: "nrd_detector",
      timestamp: now - 10000,
      domain: "old.com",
      title: "Old",
      description: "",
      indicators: [],
      context: { riskFactors: [] },
      mitigationActions: [],
      timeline: [],
      relatedThreats: [],
      notes: [],
    });

    await store.saveThreat({
      id: "new",
      type: "phishing",
      severity: "medium",
      status: "active",
      source: "nrd_detector",
      timestamp: now,
      domain: "new.com",
      title: "New",
      description: "",
      indicators: [],
      context: { riskFactors: [] },
      mitigationActions: [],
      timeline: [],
      relatedThreats: [],
      notes: [],
    });

    const threats = await store.getThreats();
    expect(threats[0].id).toBe("new");
    expect(threats[1].id).toBe("old");
  });
});

describe("createRuntimeProtector", () => {
  describe("detectThreat", () => {
    it("returns null when disabled", async () => {
      const protector = createRuntimeProtector({ enabled: false });

      const event: ThreatDetectionEvent = {
        source: "nrd_detector",
        domain: "suspicious.com",
        timestamp: Date.now(),
        data: { isNRD: true },
      };

      const result = await protector.detectThreat(event);
      expect(result).toBeNull();
    });

    it("detects NRD threat", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "nrd_detector",
        domain: "newdomain.xyz",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      };

      const result = await protector.detectThreat(event);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("phishing");
      expect(result?.severity).toBe("high");
      expect(result?.domain).toBe("newdomain.xyz");
    });

    it("detects NRD with medium confidence", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "nrd_detector",
        domain: "newdomain.xyz",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "medium" },
      };

      const result = await protector.detectThreat(event);
      expect(result?.severity).toBe("medium");
    });

    it("detects typosquat threat", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "typosquat_detector",
        domain: "g00gle.com",
        timestamp: Date.now(),
        data: { isTyposquat: true, similarTo: "google.com" },
      };

      const result = await protector.detectThreat(event);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("phishing");
      expect(result?.severity).toBe("high");
      expect(result?.description).toContain("google.com");
    });

    it("detects AI data exfiltration", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "ai_monitor",
        domain: "openai.com",
        timestamp: Date.now(),
        data: {
          hasSensitiveData: true,
          dataTypes: ["credentials", "pii"],
        },
      };

      const result = await protector.detectThreat(event);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("data_exfiltration");
      expect(result?.description).toContain("credentials");
    });

    it("detects CSP violations with high count", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "csp_monitor",
        domain: "suspicious.com",
        timestamp: Date.now(),
        data: {
          directive: "script-src",
          violationCount: 25,
        },
      };

      const result = await protector.detectThreat(event);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("xss_attempt");
      expect(result?.severity).toBe("high");
    });

    it("does not detect CSP violations with low count", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "csp_monitor",
        domain: "normal.com",
        timestamp: Date.now(),
        data: {
          directive: "script-src",
          violationCount: 2,
        },
      };

      const result = await protector.detectThreat(event);
      expect(result).toBeNull();
    });

    it("detects extension suspicious activity", async () => {
      const protector = createRuntimeProtector();

      const event: ThreatDetectionEvent = {
        source: "extension_monitor",
        domain: "example.com",
        timestamp: Date.now(),
        data: {
          isSuspicious: true,
          extensionName: "Suspicious Extension",
          extensionId: "ext123",
          requestCount: 100,
        },
      };

      const result = await protector.detectThreat(event);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("unauthorized_access");
      expect(result?.description).toContain("Suspicious Extension");
    });

    it("notifies listeners on threat detection", async () => {
      const protector = createRuntimeProtector();
      const listener = vi.fn();

      protector.subscribe(listener);

      const event: ThreatDetectionEvent = {
        source: "nrd_detector",
        domain: "suspicious.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      };

      await protector.detectThreat(event);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].domain).toBe("suspicious.com");
    });
  });

  describe("getActiveThreats", () => {
    it("returns only active and investigating threats", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      // Detect some threats
      await protector.detectThreat({
        source: "nrd_detector",
        domain: "active.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      const active = await protector.getActiveThreats();
      expect(active.length).toBeGreaterThan(0);
      expect(active.every((t) => t.status === "active" || t.status === "investigating")).toBe(true);
    });
  });

  describe("mitigateThreat", () => {
    it("adds mitigation action to threat", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      const threat = await protector.detectThreat({
        source: "typosquat_detector",
        domain: "phishing.com",
        timestamp: Date.now(),
        data: { isTyposquat: true },
      });

      await protector.mitigateThreat(threat!.id, "block_domain");

      const threats = await store.getThreats();
      const updated = threats.find((t) => t.id === threat!.id);

      expect(updated?.mitigationActions).toHaveLength(1);
      expect(updated?.mitigationActions[0].type).toBe("block_domain");
      expect(updated?.status).toBe("mitigated");
    });

    it("sets investigating status for manual_review", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      const threat = await protector.detectThreat({
        source: "nrd_detector",
        domain: "suspicious.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "medium" },
      });

      await protector.mitigateThreat(threat!.id, "manual_review");

      const threats = await store.getThreats();
      const updated = threats.find((t) => t.id === threat!.id);

      expect(updated?.status).toBe("investigating");
    });
  });

  describe("updateThreatStatus", () => {
    it("updates threat status", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      const threat = await protector.detectThreat({
        source: "nrd_detector",
        domain: "test.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      await protector.updateThreatStatus(threat!.id, "resolved");

      const threats = await store.getThreats();
      const updated = threats.find((t) => t.id === threat!.id);

      expect(updated?.status).toBe("resolved");
      expect(updated?.resolvedAt).toBeDefined();
    });

    it("adds timeline entry", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      const threat = await protector.detectThreat({
        source: "nrd_detector",
        domain: "test.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      const initialTimelineLength = threat!.timeline.length;

      await protector.updateThreatStatus(threat!.id, "dismissed");

      const threats = await store.getThreats();
      const updated = threats.find((t) => t.id === threat!.id);

      expect(updated?.timeline.length).toBeGreaterThan(initialTimelineLength);
    });
  });

  describe("createIncident", () => {
    it("creates incident from threats", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      const threat1 = await protector.detectThreat({
        source: "nrd_detector",
        domain: "site1.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      const threat2 = await protector.detectThreat({
        source: "typosquat_detector",
        domain: "site2.com",
        timestamp: Date.now(),
        data: { isTyposquat: true },
      });

      const incident = await protector.createIncident(
        [threat1!.id, threat2!.id],
        "Multiple phishing attempts"
      );

      expect(incident.id).toMatch(/^incident_/);
      expect(incident.threats).toHaveLength(2);
      expect(incident.status).toBe("open");
      expect(incident.severity).toBe("high");
    });

    it("updates related threats to investigating", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      const threat = await protector.detectThreat({
        source: "nrd_detector",
        domain: "test.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      await protector.createIncident([threat!.id], "Test incident");

      const threats = await store.getThreats();
      const updated = threats.find((t) => t.id === threat!.id);

      expect(updated?.status).toBe("investigating");
    });
  });

  describe("getStats", () => {
    it("returns stats for empty store", async () => {
      const protector = createRuntimeProtector();
      const stats = await protector.getStats();

      expect(stats.activeThreats).toBe(0);
      expect(stats.threatsToday).toBe(0);
      expect(stats.mitigatedThreats).toBe(0);
      expect(stats.openIncidents).toBe(0);
    });

    it("counts threats correctly", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      await protector.detectThreat({
        source: "nrd_detector",
        domain: "site1.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      await protector.detectThreat({
        source: "typosquat_detector",
        domain: "site2.com",
        timestamp: Date.now(),
        data: { isTyposquat: true },
      });

      const stats = await protector.getStats();

      expect(stats.activeThreats).toBe(2);
      expect(stats.threatsToday).toBe(2);
      expect(stats.threatsBySeverity.high).toBe(2);
    });

    it("tracks threats by type", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      await protector.detectThreat({
        source: "nrd_detector",
        domain: "test.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      const stats = await protector.getStats();
      expect(stats.threatsByType.phishing).toBe(1);
    });

    it("tracks top threat domains", async () => {
      const store = createInMemoryRuntimeStore();
      const protector = createRuntimeProtector({}, store);

      await protector.detectThreat({
        source: "nrd_detector",
        domain: "repeat.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      await protector.detectThreat({
        source: "typosquat_detector",
        domain: "repeat.com",
        timestamp: Date.now() + 1,
        data: { isTyposquat: true },
      });

      const stats = await protector.getStats();
      expect(stats.topThreatDomains[0].domain).toBe("repeat.com");
      expect(stats.topThreatDomains[0].count).toBe(2);
    });
  });

  describe("subscribe", () => {
    it("unsubscribes listener", async () => {
      const protector = createRuntimeProtector();
      const listener = vi.fn();

      const unsubscribe = protector.subscribe(listener);
      unsubscribe();

      await protector.detectThreat({
        source: "nrd_detector",
        domain: "test.com",
        timestamp: Date.now(),
        data: { isNRD: true, confidence: "high" },
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
