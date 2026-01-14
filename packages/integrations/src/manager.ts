/**
 * @fileoverview Integration Manager
 *
 * Manages external integrations and workflow automation.
 */

import type {
  Integration,
  IntegrationType,
  IntegrationConfig,
  IntegrationTrigger,
  IntegrationPayload,
  Workflow,
  WorkflowAction,
} from "./types.js";

export interface IntegrationStore {
  getIntegrations(): Promise<Integration[]>;
  saveIntegration(integration: Integration): Promise<void>;
  deleteIntegration(id: string): Promise<void>;
  getWorkflows(): Promise<Workflow[]>;
  saveWorkflow(workflow: Workflow): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;
}

export interface IntegrationManager {
  addIntegration(
    name: string,
    type: IntegrationType,
    config: IntegrationConfig,
    triggers: IntegrationTrigger[]
  ): Promise<Integration>;
  updateIntegration(id: string, updates: Partial<Integration>): Promise<void>;
  removeIntegration(id: string): Promise<void>;
  getIntegrations(): Promise<Integration[]>;
  testIntegration(id: string): Promise<boolean>;
  triggerIntegration(id: string, payload: IntegrationPayload): Promise<void>;
  processEvent(payload: IntegrationPayload): Promise<void>;
  addWorkflow(workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt" | "runCount">): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<Workflow>): Promise<void>;
  removeWorkflow(id: string): Promise<void>;
  getWorkflows(): Promise<Workflow[]>;
  runWorkflow(id: string, payload?: IntegrationPayload): Promise<void>;
}

/**
 * Create in-memory store
 */
export function createInMemoryIntegrationStore(): IntegrationStore {
  const integrations = new Map<string, Integration>();
  const workflows = new Map<string, Workflow>();

  return {
    async getIntegrations() {
      return Array.from(integrations.values());
    },
    async saveIntegration(integration) {
      integrations.set(integration.id, integration);
    },
    async deleteIntegration(id) {
      integrations.delete(id);
    },
    async getWorkflows() {
      return Array.from(workflows.values());
    },
    async saveWorkflow(workflow) {
      workflows.set(workflow.id, workflow);
    },
    async deleteWorkflow(id) {
      workflows.delete(id);
    },
  };
}

/**
 * Create integration manager
 */
export function createIntegrationManager(
  store?: IntegrationStore
): IntegrationManager {
  const internalStore = store || createInMemoryIntegrationStore();

  function generateId(): string {
    return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add new integration
   */
  async function addIntegration(
    name: string,
    type: IntegrationType,
    config: IntegrationConfig,
    triggers: IntegrationTrigger[]
  ): Promise<Integration> {
    const integration: Integration = {
      id: generateId(),
      name,
      type,
      status: "pending",
      config,
      triggers,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await internalStore.saveIntegration(integration);
    return integration;
  }

  /**
   * Update integration
   */
  async function updateIntegration(
    id: string,
    updates: Partial<Integration>
  ): Promise<void> {
    const integrations = await internalStore.getIntegrations();
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;

    const updated = { ...integration, ...updates, updatedAt: Date.now() };
    await internalStore.saveIntegration(updated);
  }

  /**
   * Remove integration
   */
  async function removeIntegration(id: string): Promise<void> {
    await internalStore.deleteIntegration(id);
  }

  /**
   * Get all integrations
   */
  async function getIntegrations(): Promise<Integration[]> {
    return internalStore.getIntegrations();
  }

  /**
   * Test integration connectivity
   */
  async function testIntegration(id: string): Promise<boolean> {
    const integrations = await internalStore.getIntegrations();
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return false;

    try {
      // For webhook/slack, try a test request
      // TODO: Make actual HTTP request in production

      await updateIntegration(id, { status: "active" });
      return true;
    } catch (error) {
      await updateIntegration(id, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Trigger integration with payload
   */
  async function triggerIntegration(
    id: string,
    payload: IntegrationPayload
  ): Promise<void> {
    const integrations = await internalStore.getIntegrations();
    const integration = integrations.find((i) => i.id === id);
    if (!integration || integration.status !== "active") return;

    try {
      await sendPayload(integration, payload);
      await updateIntegration(id, { lastTriggered: Date.now() });
    } catch (error) {
      await updateIntegration(id, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Send failed",
      });
    }
  }

  /**
   * Send payload to integration
   */
  async function sendPayload(
    integration: Integration,
    payload: IntegrationPayload
  ): Promise<void> {
    const { config } = integration;

    if (config.type === "webhook") {
      // TODO: In production, make actual HTTP request to config.url
      void payload; // Consume payload to avoid unused variable warning
    } else if (config.type === "slack") {
      // Format Slack message
      formatSlackMessage(payload);
      // TODO: In production, send to config.webhookUrl
    } else if (config.type === "email") {
      // TODO: In production, send email to config.recipients
      void payload;
    }
  }

  /**
   * Format payload for Slack
   */
  function formatSlackMessage(payload: IntegrationPayload): object {
    const severityColors: Record<string, string> = {
      critical: "#dc2626",
      high: "#f97316",
      medium: "#eab308",
      low: "#22c55e",
      info: "#6b7280",
    };

    return {
      attachments: [
        {
          color: severityColors[payload.severity],
          title: payload.title,
          text: payload.description,
          fields: [
            { title: "Severity", value: payload.severity, short: true },
            { title: "Event", value: payload.event, short: true },
            ...(payload.domain
              ? [{ title: "Domain", value: payload.domain, short: true }]
              : []),
          ],
          ts: Math.floor(payload.timestamp / 1000),
        },
      ],
    };
  }

  /**
   * Process event and trigger matching integrations
   */
  async function processEvent(payload: IntegrationPayload): Promise<void> {
    const integrations = await internalStore.getIntegrations();

    for (const integration of integrations) {
      if (integration.status !== "active") continue;

      // Check if any trigger matches
      const shouldTrigger = integration.triggers.some((trigger) => {
        if (!trigger.enabled) return false;
        if (trigger.event !== payload.event) return false;

        // Check conditions
        if (trigger.conditions) {
          return trigger.conditions.every((cond) => {
            const value = payload.data[cond.field];
            switch (cond.operator) {
              case "equals":
                return value === cond.value;
              case "contains":
                return String(value).includes(String(cond.value));
              case "greater_than":
                return Number(value) > Number(cond.value);
              case "less_than":
                return Number(value) < Number(cond.value);
              default:
                return false;
            }
          });
        }

        return true;
      });

      if (shouldTrigger) {
        await triggerIntegration(integration.id, payload);
      }
    }

    // Also check workflows
    const workflows = await internalStore.getWorkflows();
    for (const workflow of workflows) {
      if (!workflow.enabled) continue;
      if (workflow.trigger.type !== "event") continue;
      if (workflow.trigger.event !== payload.event) continue;

      await runWorkflow(workflow.id, payload);
    }
  }

  /**
   * Add workflow
   */
  async function addWorkflow(
    data: Omit<Workflow, "id" | "createdAt" | "updatedAt" | "runCount">
  ): Promise<Workflow> {
    const workflow: Workflow = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runCount: 0,
    };

    await internalStore.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Update workflow
   */
  async function updateWorkflow(
    id: string,
    updates: Partial<Workflow>
  ): Promise<void> {
    const workflows = await internalStore.getWorkflows();
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;

    const updated = { ...workflow, ...updates, updatedAt: Date.now() };
    await internalStore.saveWorkflow(updated);
  }

  /**
   * Remove workflow
   */
  async function removeWorkflow(id: string): Promise<void> {
    await internalStore.deleteWorkflow(id);
  }

  /**
   * Get all workflows
   */
  async function getWorkflows(): Promise<Workflow[]> {
    return internalStore.getWorkflows();
  }

  /**
   * Run workflow
   */
  async function runWorkflow(
    id: string,
    payload?: IntegrationPayload
  ): Promise<void> {
    const workflows = await internalStore.getWorkflows();
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow || !workflow.enabled) return;

    // Sort actions by order
    const sortedActions = [...workflow.actions].sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      await executeAction(action, payload);
    }

    await updateWorkflow(id, {
      lastRun: Date.now(),
      runCount: workflow.runCount + 1,
    });
  }

  /**
   * Execute workflow action
   */
  async function executeAction(
    action: WorkflowAction,
    _payload?: IntegrationPayload
  ): Promise<void> {
    switch (action.type) {
      case "send_notification":
        // Send notification through configured channel
        break;
      case "create_ticket":
        // Create ticket in configured system
        break;
      case "block_domain":
        // Add domain to blocklist
        break;
      case "add_to_watchlist":
        // Add to monitoring watchlist
        break;
      case "generate_report":
        // Generate report
        break;
      case "log_event":
        // Log event - handled by integration system
        break;
    }
  }

  return {
    addIntegration,
    updateIntegration,
    removeIntegration,
    getIntegrations,
    testIntegration,
    triggerIntegration,
    processEvent,
    addWorkflow,
    updateWorkflow,
    removeWorkflow,
    getWorkflows,
    runWorkflow,
  };
}
