import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInMemoryIntegrationStore,
  createIntegrationManager,
  type IntegrationStore,
} from "./manager.js";
import type {
  Integration,
  IntegrationConfig,
  IntegrationPayload,
  IntegrationTrigger,
  Workflow,
  WebhookConfig,
  SlackConfig,
} from "./types.js";
import { INTEGRATION_TEMPLATES, WORKFLOW_TEMPLATES } from "./types.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock crypto.subtle
vi.stubGlobal("crypto", {
  subtle: {
    importKey: vi.fn().mockResolvedValue({}),
    sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  },
});

function createWebhookConfig(overrides: Partial<WebhookConfig> = {}): WebhookConfig {
  return {
    type: "webhook",
    url: "https://example.com/webhook",
    method: "POST",
    ...overrides,
  };
}

function createSlackConfig(overrides: Partial<SlackConfig> = {}): SlackConfig {
  return {
    type: "slack",
    webhookUrl: "https://hooks.slack.com/services/xxx",
    ...overrides,
  };
}

function createPayload(overrides: Partial<IntegrationPayload> = {}): IntegrationPayload {
  return {
    event: "typosquat_detected",
    timestamp: Date.now(),
    severity: "high",
    title: "Test Alert",
    description: "Test description",
    domain: "example.com",
    data: {},
    source: "test",
    ...overrides,
  };
}

describe("createInMemoryIntegrationStore", () => {
  it("creates an empty store", async () => {
    const store = createInMemoryIntegrationStore();

    const integrations = await store.getIntegrations();
    const workflows = await store.getWorkflows();

    expect(integrations).toHaveLength(0);
    expect(workflows).toHaveLength(0);
  });

  it("saves and retrieves integrations", async () => {
    const store = createInMemoryIntegrationStore();
    const integration: Integration = {
      id: "int_1",
      name: "Test",
      type: "webhook",
      status: "active",
      config: createWebhookConfig(),
      triggers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await store.saveIntegration(integration);
    const integrations = await store.getIntegrations();

    expect(integrations).toHaveLength(1);
    expect(integrations[0].id).toBe("int_1");
  });

  it("deletes integrations", async () => {
    const store = createInMemoryIntegrationStore();
    const integration: Integration = {
      id: "int_1",
      name: "Test",
      type: "webhook",
      status: "active",
      config: createWebhookConfig(),
      triggers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await store.saveIntegration(integration);
    await store.deleteIntegration("int_1");
    const integrations = await store.getIntegrations();

    expect(integrations).toHaveLength(0);
  });

  it("saves and retrieves workflows", async () => {
    const store = createInMemoryIntegrationStore();
    const workflow: Workflow = {
      id: "wf_1",
      name: "Test Workflow",
      description: "Test",
      enabled: true,
      trigger: { type: "event", event: "nrd_access" },
      actions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runCount: 0,
    };

    await store.saveWorkflow(workflow);
    const workflows = await store.getWorkflows();

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe("wf_1");
  });

  it("deletes workflows", async () => {
    const store = createInMemoryIntegrationStore();
    const workflow: Workflow = {
      id: "wf_1",
      name: "Test",
      description: "Test",
      enabled: true,
      trigger: { type: "event" },
      actions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runCount: 0,
    };

    await store.saveWorkflow(workflow);
    await store.deleteWorkflow("wf_1");
    const workflows = await store.getWorkflows();

    expect(workflows).toHaveLength(0);
  });
});

describe("createIntegrationManager", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("integration management", () => {
    it("adds integration", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [{ event: "nrd_access", enabled: true }];

      const integration = await manager.addIntegration("Test", "webhook", config, triggers);

      expect(integration.id).toBeDefined();
      expect(integration.name).toBe("Test");
      expect(integration.type).toBe("webhook");
      expect(integration.status).toBe("pending");
      expect(integration.triggers).toEqual(triggers);
    });

    it("generates unique IDs", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();

      const int1 = await manager.addIntegration("Test 1", "webhook", config, []);
      const int2 = await manager.addIntegration("Test 2", "webhook", config, []);

      expect(int1.id).not.toBe(int2.id);
    });

    it("gets all integrations", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();

      await manager.addIntegration("Test 1", "webhook", config, []);
      await manager.addIntegration("Test 2", "slack", createSlackConfig(), []);

      const integrations = await manager.getIntegrations();

      expect(integrations).toHaveLength(2);
    });

    it("updates integration", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);

      await manager.updateIntegration(integration.id, { name: "Updated", status: "active" });

      const integrations = await manager.getIntegrations();
      const updated = integrations.find((i) => i.id === integration.id);

      expect(updated?.name).toBe("Updated");
      expect(updated?.status).toBe("active");
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(integration.updatedAt);
    });

    it("handles update for non-existent integration", async () => {
      const manager = createIntegrationManager();

      // Should not throw
      await manager.updateIntegration("non_existent", { name: "Updated" });

      const integrations = await manager.getIntegrations();
      expect(integrations).toHaveLength(0);
    });

    it("removes integration", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);

      await manager.removeIntegration(integration.id);

      const integrations = await manager.getIntegrations();
      expect(integrations).toHaveLength(0);
    });
  });

  describe("testIntegration", () => {
    it("returns false for non-existent integration", async () => {
      const manager = createIntegrationManager();

      const result = await manager.testIntegration("non_existent");

      expect(result).toBe(false);
    });

    it("tests webhook integration", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);

      const result = await manager.testIntegration(integration.id);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(config.url, expect.objectContaining({ method: "HEAD" }));
    });

    it("tests slack integration", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const manager = createIntegrationManager();
      const config = createSlackConfig();
      const integration = await manager.addIntegration("Test", "slack", config, []);

      const result = await manager.testIntegration(integration.id);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        config.webhookUrl,
        expect.objectContaining({ method: "POST" })
      );
    });

    it("handles test failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);

      const result = await manager.testIntegration(integration.id);

      expect(result).toBe(false);

      const integrations = await manager.getIntegrations();
      const updated = integrations.find((i) => i.id === integration.id);
      expect(updated?.status).toBe("error");
      expect(updated?.errorMessage).toBe("Network error");
    });

    it("handles slack response not ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      const manager = createIntegrationManager();
      const config = createSlackConfig();
      const integration = await manager.addIntegration("Test", "slack", config, []);

      const result = await manager.testIntegration(integration.id);

      expect(result).toBe(false);
    });
  });

  describe("triggerIntegration", () => {
    it("does not trigger non-existent integration", async () => {
      const manager = createIntegrationManager();
      const payload = createPayload();

      await manager.triggerIntegration("non_existent", payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not trigger inactive integration", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);
      // Integration starts as "pending", not "active"

      const payload = createPayload();
      await manager.triggerIntegration(integration.id, payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("triggers active webhook integration", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);
      await manager.updateIntegration(integration.id, { status: "active" });

      const payload = createPayload();
      await manager.triggerIntegration(integration.id, payload);

      expect(mockFetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({ method: "POST" })
      );
    });

    it("updates lastTriggered on success", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);
      await manager.updateIntegration(integration.id, { status: "active" });

      const payload = createPayload();
      await manager.triggerIntegration(integration.id, payload);

      const integrations = await manager.getIntegrations();
      const updated = integrations.find((i) => i.id === integration.id);
      expect(updated?.lastTriggered).toBeDefined();
    });

    it("sets error status on failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const integration = await manager.addIntegration("Test", "webhook", config, []);
      await manager.updateIntegration(integration.id, { status: "active" });

      const payload = createPayload();
      await manager.triggerIntegration(integration.id, payload);

      const integrations = await manager.getIntegrations();
      const updated = integrations.find((i) => i.id === integration.id);
      expect(updated?.status).toBe("error");
    });
  });

  describe("processEvent", () => {
    it("triggers matching integrations", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [{ event: "nrd_access", enabled: true }];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      const payload = createPayload({ event: "nrd_access" });
      await manager.processEvent(payload);

      expect(mockFetch).toHaveBeenCalled();
    });

    it("does not trigger non-matching events", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [{ event: "nrd_access", enabled: true }];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      const payload = createPayload({ event: "typosquat_detected" });
      await manager.processEvent(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not trigger disabled triggers", async () => {
      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [{ event: "nrd_access", enabled: false }];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      const payload = createPayload({ event: "nrd_access" });
      await manager.processEvent(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("evaluates trigger conditions - equals", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [
        {
          event: "nrd_access",
          enabled: true,
          conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
        },
      ];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      // Matching condition
      await manager.processEvent(createPayload({ event: "nrd_access", data: { domain: "test.com" } }));
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Non-matching condition
      mockFetch.mockClear();
      await manager.processEvent(createPayload({ event: "nrd_access", data: { domain: "other.com" } }));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("evaluates trigger conditions - contains", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [
        {
          event: "nrd_access",
          enabled: true,
          conditions: [{ field: "url", operator: "contains", value: "evil" }],
        },
      ];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      await manager.processEvent(createPayload({ event: "nrd_access", data: { url: "https://evil.com" } }));
      expect(mockFetch).toHaveBeenCalled();
    });

    it("evaluates trigger conditions - greater_than", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [
        {
          event: "nrd_access",
          enabled: true,
          conditions: [{ field: "score", operator: "greater_than", value: 50 }],
        },
      ];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      await manager.processEvent(createPayload({ event: "nrd_access", data: { score: 75 } }));
      expect(mockFetch).toHaveBeenCalled();
    });

    it("evaluates trigger conditions - less_than", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();
      const config = createWebhookConfig();
      const triggers: IntegrationTrigger[] = [
        {
          event: "nrd_access",
          enabled: true,
          conditions: [{ field: "score", operator: "less_than", value: 50 }],
        },
      ];
      const integration = await manager.addIntegration("Test", "webhook", config, triggers);
      await manager.updateIntegration(integration.id, { status: "active" });

      await manager.processEvent(createPayload({ event: "nrd_access", data: { score: 25 } }));
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("workflow management", () => {
    it("adds workflow", async () => {
      const manager = createIntegrationManager();

      const workflow = await manager.addWorkflow({
        name: "Test Workflow",
        description: "Test",
        enabled: true,
        trigger: { type: "event", event: "nrd_access" },
        actions: [{ id: "act_1", type: "log_event", config: {}, order: 1 }],
      });

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toBe("Test Workflow");
      expect(workflow.runCount).toBe(0);
    });

    it("gets all workflows", async () => {
      const manager = createIntegrationManager();

      await manager.addWorkflow({
        name: "Workflow 1",
        description: "Test 1",
        enabled: true,
        trigger: { type: "event" },
        actions: [],
      });
      await manager.addWorkflow({
        name: "Workflow 2",
        description: "Test 2",
        enabled: true,
        trigger: { type: "manual" },
        actions: [],
      });

      const workflows = await manager.getWorkflows();

      expect(workflows).toHaveLength(2);
    });

    it("updates workflow", async () => {
      const manager = createIntegrationManager();
      const workflow = await manager.addWorkflow({
        name: "Test",
        description: "Test",
        enabled: true,
        trigger: { type: "event" },
        actions: [],
      });

      await manager.updateWorkflow(workflow.id, { name: "Updated", enabled: false });

      const workflows = await manager.getWorkflows();
      const updated = workflows.find((w) => w.id === workflow.id);

      expect(updated?.name).toBe("Updated");
      expect(updated?.enabled).toBe(false);
    });

    it("removes workflow", async () => {
      const manager = createIntegrationManager();
      const workflow = await manager.addWorkflow({
        name: "Test",
        description: "Test",
        enabled: true,
        trigger: { type: "event" },
        actions: [],
      });

      await manager.removeWorkflow(workflow.id);

      const workflows = await manager.getWorkflows();
      expect(workflows).toHaveLength(0);
    });

    it("runs workflow", async () => {
      const manager = createIntegrationManager();
      const workflow = await manager.addWorkflow({
        name: "Test",
        description: "Test",
        enabled: true,
        trigger: { type: "manual" },
        actions: [{ id: "act_1", type: "log_event", config: {}, order: 1 }],
      });

      await manager.runWorkflow(workflow.id, createPayload());

      const workflows = await manager.getWorkflows();
      const updated = workflows.find((w) => w.id === workflow.id);

      expect(updated?.runCount).toBe(1);
      expect(updated?.lastRun).toBeDefined();
    });

    it("does not run disabled workflow", async () => {
      const manager = createIntegrationManager();
      const workflow = await manager.addWorkflow({
        name: "Test",
        description: "Test",
        enabled: false,
        trigger: { type: "manual" },
        actions: [{ id: "act_1", type: "log_event", config: {}, order: 1 }],
      });

      await manager.runWorkflow(workflow.id, createPayload());

      const workflows = await manager.getWorkflows();
      const updated = workflows.find((w) => w.id === workflow.id);

      expect(updated?.runCount).toBe(0);
    });

    it("executes actions in order", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const manager = createIntegrationManager();

      // Add active slack integration for send_notification action
      const integration = await manager.addIntegration("Slack", "slack", createSlackConfig(), []);
      await manager.updateIntegration(integration.id, { status: "active" });

      const workflow = await manager.addWorkflow({
        name: "Test",
        description: "Test",
        enabled: true,
        trigger: { type: "manual" },
        actions: [
          { id: "act_2", type: "log_event", config: {}, order: 2 },
          { id: "act_1", type: "send_notification", config: { channel: "slack" }, order: 1 },
          { id: "act_3", type: "log_event", config: {}, order: 3 },
        ],
      });

      await manager.runWorkflow(workflow.id, createPayload());

      // Verify workflow was run
      const workflows = await manager.getWorkflows();
      const updated = workflows.find((w) => w.id === workflow.id);
      expect(updated?.runCount).toBe(1);
    });
  });
});

describe("INTEGRATION_TEMPLATES", () => {
  it("contains expected integration types", () => {
    const types = INTEGRATION_TEMPLATES.map((t) => t.type);

    expect(types).toContain("slack");
    expect(types).toContain("webhook");
    expect(types).toContain("email");
    expect(types).toContain("jira");
    expect(types).toContain("github");
  });

  it("has required fields for each template", () => {
    for (const template of INTEGRATION_TEMPLATES) {
      expect(template.type).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.description).toBeDefined();
      expect(template.icon).toBeDefined();
    }
  });
});

describe("WORKFLOW_TEMPLATES", () => {
  it("contains expected workflow templates", () => {
    const names = WORKFLOW_TEMPLATES.map((t) => t.name);

    expect(names).toContain("Critical Typosquat Alert");
    expect(names).toContain("NRD Block");
    expect(names).toContain("Weekly Security Report");
  });

  it("has required fields for each template", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      expect(template.name).toBeDefined();
      expect(template.description).toBeDefined();
      expect(template.trigger).toBeDefined();
      expect(template.actions).toBeInstanceOf(Array);
    }
  });

  it("templates have valid trigger types", () => {
    const validTypes = ["event", "schedule", "manual"];
    for (const template of WORKFLOW_TEMPLATES) {
      expect(validTypes).toContain(template.trigger.type);
    }
  });

  it("templates have ordered actions", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      for (const action of template.actions) {
        expect(action.order).toBeGreaterThan(0);
        expect(action.type).toBeDefined();
      }
    }
  });
});
