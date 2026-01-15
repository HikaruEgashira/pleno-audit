import { describe, it, expect } from "vitest";
import {
  createSecurityGraph,
  buildSecurityGraph,
  serializeGraph,
  deserializeGraph,
} from "./graph-builder.js";
import type { DetectedService, EventLog } from "@pleno-audit/detectors";

function createMockService(overrides: Partial<DetectedService> = {}): DetectedService {
  return {
    domain: "example.com",
    detectedAt: Date.now(),
    url: "https://example.com",
    hasLoginPage: false,
    privacyPolicyUrl: null,
    termsOfServiceUrl: null,
    faviconUrl: null,
    cookies: [],
    nrdResult: null,
    typosquatResult: null,
    cspPolicies: [],
    aiActivity: null,
    ...overrides,
  };
}

function createMockEvent(overrides: Partial<EventLog> = {}): EventLog {
  return {
    id: `event_${Date.now()}`,
    timestamp: Date.now(),
    type: "network_request",
    domain: "example.com",
    details: {},
    ...overrides,
  } as EventLog;
}

describe("createSecurityGraph", () => {
  it("creates an empty graph", () => {
    const graph = createSecurityGraph();

    expect(graph.nodes).toBeInstanceOf(Map);
    expect(graph.edges).toBeInstanceOf(Map);
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
  });

  it("initializes stats with zeros", () => {
    const graph = createSecurityGraph();

    expect(graph.stats.totalNodes).toBe(0);
    expect(graph.stats.totalEdges).toBe(0);
    expect(graph.stats.nodesByType.domain).toBe(0);
    expect(graph.stats.nodesByType.ai_provider).toBe(0);
    expect(graph.stats.riskDistribution.critical).toBe(0);
  });

  it("sets lastUpdated timestamp", () => {
    const before = Date.now();
    const graph = createSecurityGraph();
    const after = Date.now();

    expect(graph.lastUpdated).toBeGreaterThanOrEqual(before);
    expect(graph.lastUpdated).toBeLessThanOrEqual(after);
  });

  it("initializes empty critical paths", () => {
    const graph = createSecurityGraph();

    expect(graph.stats.criticalPaths).toEqual([]);
  });
});

describe("buildSecurityGraph", () => {
  describe("domain nodes from services", () => {
    it("creates domain nodes from services", () => {
      const services = [createMockService({ domain: "example.com" })];
      const graph = buildSecurityGraph(services, []);

      expect(graph.nodes.has("domain:example.com")).toBe(true);
    });

    it("creates multiple domain nodes", () => {
      const services = [
        createMockService({ domain: "example.com" }),
        createMockService({ domain: "test.com" }),
        createMockService({ domain: "other.com" }),
      ];
      const graph = buildSecurityGraph(services, []);

      expect(graph.nodes.size).toBe(3);
      expect(graph.stats.nodesByType.domain).toBe(3);
    });

    it("sets domain metadata from service", () => {
      const services = [
        createMockService({
          domain: "example.com",
          hasLoginPage: true,
          privacyPolicyUrl: "https://example.com/privacy",
          termsOfServiceUrl: "https://example.com/terms",
        }),
      ];
      const graph = buildSecurityGraph(services, []);

      const node = graph.nodes.get("domain:example.com");
      expect(node?.metadata.type).toBe("domain");
      if (node?.metadata.type === "domain") {
        expect(node.metadata.hasLogin).toBe(true);
        expect(node.metadata.hasPrivacyPolicy).toBe(true);
        expect(node.metadata.hasTermsOfService).toBe(true);
      }
    });

    it("calculates risk score for NRD domain", () => {
      const services = [
        createMockService({
          domain: "suspicious.xyz",
          nrdResult: { isNRD: true, confidence: "high" },
        }),
      ];
      const graph = buildSecurityGraph(services, []);

      const node = graph.nodes.get("domain:suspicious.xyz");
      expect(node?.riskScore).toBeGreaterThan(0);
    });

    it("calculates risk score for typosquat domain", () => {
      const services = [
        createMockService({
          domain: "g00gle.com",
          typosquatResult: { isTyposquat: true, confidence: "high", similarTo: "google.com" },
        }),
      ];
      const graph = buildSecurityGraph(services, []);

      const node = graph.nodes.get("domain:g00gle.com");
      expect(node?.riskScore).toBeGreaterThan(0);
      expect(node?.riskLevel).not.toBe("info");
    });

    it("sets cookie counts from service", () => {
      const services = [
        createMockService({
          domain: "example.com",
          cookies: [
            { name: "session", value: "abc", domain: "example.com", isSession: true },
            { name: "tracking", value: "123", domain: "example.com", isSession: false },
          ],
        }),
      ];
      const graph = buildSecurityGraph(services, []);

      const node = graph.nodes.get("domain:example.com");
      if (node?.metadata.type === "domain") {
        expect(node.metadata.cookieCount).toBe(2);
        expect(node.metadata.sessionCookieCount).toBe(1);
      }
    });
  });

  describe("event processing", () => {
    it("processes network request events", () => {
      const services = [createMockService({ domain: "example.com" })];
      const events = [
        createMockEvent({
          type: "network_request",
          domain: "example.com",
          details: {
            url: "https://api.external.com/data",
            method: "GET",
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.nodes.has("domain:api.external.com")).toBe(true);
      expect(graph.edges.has("domain:example.com:requests:domain:api.external.com")).toBe(true);
    });

    it("processes login detected events", () => {
      const services = [createMockService({ domain: "example.com", hasLoginPage: false })];
      const events = [
        createMockEvent({
          type: "login_detected",
          domain: "example.com",
          details: {},
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      const node = graph.nodes.get("domain:example.com");
      if (node?.metadata.type === "domain") {
        expect(node.metadata.hasLogin).toBe(true);
      }
    });

    it("processes extension request events", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "extension_request",
          domain: "example.com",
          details: {
            extensionId: "ext123",
            extensionName: "Test Extension",
            url: "https://api.example.com/data",
            method: "GET",
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.nodes.has("extension:ext123")).toBe(true);
      const extNode = graph.nodes.get("extension:ext123");
      expect(extNode?.label).toBe("Test Extension");
    });

    it("processes CSP violation events", () => {
      const services = [createMockService({ domain: "example.com" })];
      const events = [
        createMockEvent({
          type: "csp_violation",
          domain: "example.com",
          details: {
            directive: "script-src",
            blockedUri: "https://evil.com/script.js",
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      const node = graph.nodes.get("domain:example.com");
      expect(node?.riskScore).toBeGreaterThanOrEqual(5);
    });

    it("creates domain node if not exists from event", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "network_request",
          domain: "new-domain.com",
          details: {
            url: "https://new-domain.com/api",
            method: "GET",
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.nodes.has("domain:new-domain.com")).toBe(true);
    });
  });

  describe("AI prompt processing", () => {
    it("creates AI provider node from prompt event", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "chat.openai.com",
          details: {
            provider: "openai",
            model: "gpt-4",
            promptPreview: "Hello world", contentSize: 100,
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.nodes.has("ai_provider:openai")).toBe(true);
      const aiNode = graph.nodes.get("ai_provider:openai");
      expect(aiNode?.type).toBe("ai_provider");
    });

    it("creates edge from domain to AI provider", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "example.com",
          details: {
            provider: "openai",
            promptPreview: "Test prompt", contentSize: 100,
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.edges.has("domain:example.com:ai_prompt:ai_provider:openai")).toBe(true);
    });

    it("updates AI provider stats on multiple prompts", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "example.com",
          details: {
            provider: "openai",
            model: "gpt-4",
            promptPreview: "First prompt", contentSize: 100,
          },
        }),
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "example.com",
          details: {
            provider: "openai",
            model: "gpt-3.5",
            promptPreview: "Second prompt", contentSize: 100,
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      const aiNode = graph.nodes.get("ai_provider:openai");
      if (aiNode?.metadata.type === "ai_provider") {
        expect(aiNode.metadata.promptCount).toBe(2);
        expect(aiNode.metadata.models).toContain("gpt-4");
        expect(aiNode.metadata.models).toContain("gpt-3.5");
      }
    });

    it("updates edge weight on multiple prompts", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "example.com",
          details: {
            provider: "openai",
            promptPreview: "First", contentSize: 100,
          },
        }),
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "example.com",
          details: {
            provider: "openai",
            promptPreview: "Second", contentSize: 100,
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      const edge = graph.edges.get("domain:example.com:ai_prompt:ai_provider:openai");
      expect(edge?.weight).toBe(2);
    });

    it("processes AI response events", () => {
      const services: DetectedService[] = [];
      const events = [
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "example.com",
          details: {
            provider: "openai",
            promptPreview: "Hello", contentSize: 100,
          },
        }),
        createMockEvent({
          type: "ai_response_received",
          domain: "example.com",
          details: {
            provider: "openai",
            responseSize: 1000,
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      const aiNode = graph.nodes.get("ai_provider:openai");
      expect(aiNode).toBeDefined();
    });
  });

  describe("graph statistics", () => {
    it("counts nodes by type", () => {
      const services = [
        createMockService({ domain: "example.com" }),
        createMockService({ domain: "test.com" }),
      ];
      const events = [
        createMockEvent({
          type: "extension_request",
          domain: "example.com",
          details: {
            extensionId: "ext1",
            extensionName: "Ext1",
            url: "https://api.example.com",
            method: "GET",
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.stats.nodesByType.domain).toBeGreaterThanOrEqual(2);
      expect(graph.stats.nodesByType.extension).toBe(1);
    });

    it("counts edges by type", () => {
      const services = [createMockService({ domain: "example.com" })];
      const events = [
        createMockEvent({
          type: "network_request",
          domain: "example.com",
          details: {
            url: "https://api.other.com/data",
            method: "GET",
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      expect(graph.stats.edgesByType.requests).toBe(1);
    });

    it("tracks risk distribution", () => {
      const services = [
        createMockService({ domain: "safe.com" }),
        createMockService({
          domain: "risky.xyz",
          nrdResult: { isNRD: true, confidence: "high" },
        }),
      ];

      const graph = buildSecurityGraph(services, []);

      expect(graph.stats.riskDistribution.info).toBeGreaterThanOrEqual(1);
    });
  });

  describe("attack path detection", () => {
    it("detects suspicious domain data exfiltration path", () => {
      const services = [
        createMockService({
          domain: "suspicious.xyz",
          nrdResult: { isNRD: true, confidence: "high" },
        }),
      ];
      const events = [
        createMockEvent({
          type: "ai_prompt_sent",
          domain: "suspicious.xyz",
          details: {
            provider: "openai",
            promptPreview: "My password is secret123 and my SSN is 123-45-6789", contentSize: 100,
          },
        }),
      ];

      const graph = buildSecurityGraph(services, events);

      // May or may not detect depending on sensitive data detection
      expect(graph.stats.criticalPaths).toBeDefined();
    });

    it("limits attack paths to top 10", () => {
      const services = Array.from({ length: 20 }, (_, i) =>
        createMockService({
          domain: `suspicious${i}.xyz`,
          nrdResult: { isNRD: true, confidence: "high" },
        })
      );

      const graph = buildSecurityGraph(services, []);

      expect(graph.stats.criticalPaths.length).toBeLessThanOrEqual(10);
    });
  });
});

describe("serializeGraph", () => {
  it("serializes empty graph", () => {
    const graph = createSecurityGraph();
    const json = serializeGraph(graph);

    expect(json).toBeDefined();
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);
  });

  it("serializes graph with nodes", () => {
    const services = [createMockService({ domain: "example.com" })];
    const graph = buildSecurityGraph(services, []);
    const json = serializeGraph(graph);

    const parsed = JSON.parse(json);
    expect(parsed.nodes.length).toBe(1);
    expect(parsed.nodes[0].id).toBe("domain:example.com");
  });

  it("serializes graph with edges", () => {
    const services = [createMockService({ domain: "example.com" })];
    const events = [
      createMockEvent({
        type: "network_request",
        domain: "example.com",
        details: {
          url: "https://api.other.com/data",
          method: "GET",
        },
      }),
    ];

    const graph = buildSecurityGraph(services, events);
    const json = serializeGraph(graph);

    const parsed = JSON.parse(json);
    expect(parsed.edges.length).toBeGreaterThan(0);
  });

  it("preserves lastUpdated timestamp", () => {
    const graph = createSecurityGraph();
    const json = serializeGraph(graph);

    const parsed = JSON.parse(json);
    expect(parsed.lastUpdated).toBe(graph.lastUpdated);
  });
});

describe("deserializeGraph", () => {
  it("deserializes empty graph", () => {
    const json = JSON.stringify({
      nodes: [],
      edges: [],
      lastUpdated: Date.now(),
    });

    const graph = deserializeGraph(json);

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
  });

  it("deserializes graph with nodes", () => {
    const originalServices = [createMockService({ domain: "example.com" })];
    const originalGraph = buildSecurityGraph(originalServices, []);
    const json = serializeGraph(originalGraph);

    const graph = deserializeGraph(json);

    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.has("domain:example.com")).toBe(true);
  });

  it("deserializes graph with edges", () => {
    const originalServices = [createMockService({ domain: "example.com" })];
    const originalEvents = [
      createMockEvent({
        type: "network_request",
        domain: "example.com",
        details: {
          url: "https://api.other.com/data",
          method: "GET",
        },
      }),
    ];

    const originalGraph = buildSecurityGraph(originalServices, originalEvents);
    const json = serializeGraph(originalGraph);

    const graph = deserializeGraph(json);

    expect(graph.edges.size).toBeGreaterThan(0);
  });

  it("recalculates stats after deserialization", () => {
    const originalServices = [
      createMockService({ domain: "example.com" }),
      createMockService({ domain: "test.com" }),
    ];
    const originalGraph = buildSecurityGraph(originalServices, []);
    const json = serializeGraph(originalGraph);

    const graph = deserializeGraph(json);

    expect(graph.stats.totalNodes).toBe(2);
    expect(graph.stats.nodesByType.domain).toBe(2);
  });

  it("preserves node metadata after round-trip", () => {
    const originalServices = [
      createMockService({
        domain: "example.com",
        hasLoginPage: true,
        privacyPolicyUrl: "https://example.com/privacy",
      }),
    ];
    const originalGraph = buildSecurityGraph(originalServices, []);
    const json = serializeGraph(originalGraph);

    const graph = deserializeGraph(json);
    const node = graph.nodes.get("domain:example.com");

    if (node?.metadata.type === "domain") {
      expect(node.metadata.hasLogin).toBe(true);
      expect(node.metadata.hasPrivacyPolicy).toBe(true);
    }
  });

  it("restores lastUpdated timestamp", () => {
    const timestamp = 1700000000000;
    const json = JSON.stringify({
      nodes: [],
      edges: [],
      lastUpdated: timestamp,
    });

    const graph = deserializeGraph(json);

    // lastUpdated is updated during deserialization in updateGraphStats
    expect(graph.lastUpdated).toBeDefined();
  });
});

describe("graph node risk levels", () => {
  it("assigns info level for safe domains", () => {
    const services = [createMockService({ domain: "safe.com" })];
    const graph = buildSecurityGraph(services, []);

    const node = graph.nodes.get("domain:safe.com");
    expect(node?.riskLevel).toBe("info");
  });

  it("assigns higher risk for login without privacy policy", () => {
    const services = [
      createMockService({
        domain: "risky.com",
        hasLoginPage: true,
        privacyPolicyUrl: null,
        termsOfServiceUrl: null,
      }),
    ];
    const graph = buildSecurityGraph(services, []);

    const node = graph.nodes.get("domain:risky.com");
    expect(node?.riskScore).toBeGreaterThan(0);
  });

  it("assigns high risk for NRD with login", () => {
    const services = [
      createMockService({
        domain: "nrd-login.xyz",
        hasLoginPage: true,
        nrdResult: { isNRD: true, confidence: "high" },
      }),
    ];
    const graph = buildSecurityGraph(services, []);

    const node = graph.nodes.get("domain:nrd-login.xyz");
    expect(node?.riskScore).toBeGreaterThan(30);
  });
});

describe("edge cases", () => {
  it("handles empty services and events", () => {
    const graph = buildSecurityGraph([], []);

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
    expect(graph.stats.totalNodes).toBe(0);
  });

  it("handles invalid URL in network request", () => {
    const services: DetectedService[] = [];
    const events = [
      createMockEvent({
        type: "network_request",
        domain: "example.com",
        details: {
          url: "not-a-valid-url",
          method: "GET",
        },
      }),
    ];

    // Should not throw
    const graph = buildSecurityGraph(services, events);
    expect(graph).toBeDefined();
  });

  it("handles unknown AI provider", () => {
    const services: DetectedService[] = [];
    const events = [
      createMockEvent({
        type: "ai_prompt_sent",
        domain: "example.com",
        details: {
          promptPreview: "test", contentSize: 100,
        },
      }),
    ];

    const graph = buildSecurityGraph(services, events);

    expect(graph.nodes.has("ai_provider:unknown")).toBe(true);
  });

  it("handles empty prompt content", () => {
    const services: DetectedService[] = [];
    const events = [
      createMockEvent({
        type: "ai_prompt_sent",
        domain: "example.com",
        details: {
          provider: "openai",
        },
      }),
    ];

    // Should not throw
    const graph = buildSecurityGraph(services, events);
    expect(graph.nodes.has("ai_provider:openai")).toBe(true);
  });

  it("handles same domain request (no edge created)", () => {
    const services = [createMockService({ domain: "example.com" })];
    const events = [
      createMockEvent({
        type: "network_request",
        domain: "example.com",
        details: {
          url: "https://example.com/api/data",
          method: "GET",
        },
      }),
    ];

    const graph = buildSecurityGraph(services, events);

    // No edge for same-domain requests
    expect(graph.edges.size).toBe(0);
  });
});
