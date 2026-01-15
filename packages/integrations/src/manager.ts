/**
 * @fileoverview Integration Manager
 *
 * Manages external integrations and workflow automation.
 */

import { createLogger } from "@pleno-audit/extension-runtime";
import type {
  Integration,
  IntegrationType,
  IntegrationConfig,
  IntegrationTrigger,
  IntegrationPayload,
  Workflow,
  WorkflowAction,
  WebhookConfig,
  SlackConfig,
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

    const logger = createLogger("integrations");
    logger.info(`Testing integration: ${integration.name}`, {
      type: integration.type,
    });

    try {
      const { config } = integration;

      if (config.type === "webhook") {
        const webhookConfig = config as WebhookConfig;
        // Use no-cors mode to check endpoint reachability
        await fetch(webhookConfig.url, {
          method: "HEAD",
          mode: "no-cors",
        });
        logger.info(`Webhook endpoint reachable`);
      } else if (config.type === "slack") {
        const slackConfig = config as SlackConfig;
        // Send a test message to verify webhook
        const testPayload = {
          text: "[Pleno Audit] 接続テスト成功 ✓",
        };
        const response = await fetch(slackConfig.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
        });
        if (!response.ok) {
          throw new Error(`Slack: ${response.status}`);
        }
        logger.info(`Slack webhook test successful`);
      }

      await updateIntegration(id, { status: "active", errorMessage: undefined });
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Integration test failed: ${errorMessage}`);
      await updateIntegration(id, {
        status: "error",
        errorMessage,
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
    const logger = createLogger("integrations");
    const { config } = integration;

    if (config.type === "webhook") {
      const webhookConfig = config as WebhookConfig;
      logger.info(`Sending webhook to ${webhookConfig.url}`, {
        event: payload.event,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...webhookConfig.headers,
      };

      if (webhookConfig.secretKey) {
        headers["X-Signature"] = await computeHmacSignature(
          JSON.stringify(payload),
          webhookConfig.secretKey
        );
      }

      const response = await fetch(webhookConfig.url, {
        method: webhookConfig.method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
      logger.info(`Webhook sent successfully`, { status: response.status });
    } else if (config.type === "slack") {
      const slackConfig = config as SlackConfig;
      const slackPayload = formatSlackMessage(payload);

      logger.info(`Sending Slack message`, { event: payload.event });

      const response = await fetch(slackConfig.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }
      logger.info(`Slack message sent successfully`);
    } else if (config.type === "email") {
      logger.warn(`Email integration not supported in browser extension`);
    }
  }

  /**
   * Compute HMAC-SHA256 signature using Web Crypto API
   */
  async function computeHmacSignature(
    data: string,
    secret: string
  ): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(data)
    );
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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
    payload?: IntegrationPayload
  ): Promise<void> {
    const logger = createLogger("integrations");
    logger.info(`Executing workflow action: ${action.type}`, {
      actionId: action.id,
    });

    switch (action.type) {
      case "send_notification": {
        // Send notification through configured channel
        const channel = action.config.channel as string;
        const integrations = await internalStore.getIntegrations();
        const targetIntegration = integrations.find(
          (i) => i.type === channel && i.status === "active"
        );

        if (targetIntegration && payload) {
          await triggerIntegration(targetIntegration.id, payload);
        } else {
          logger.warn(`No active integration found for channel: ${channel}`);
        }
        break;
      }
      case "log_event": {
        // Log event with payload details
        logger.info(`[Workflow Event]`, {
          actionId: action.id,
          payload: payload
            ? {
                event: payload.event,
                severity: payload.severity,
                domain: payload.domain,
              }
            : null,
        });
        break;
      }
      case "run_integration": {
        // Trigger a specific integration
        const integrationId = action.config.integrationId as string;
        if (integrationId && payload) {
          await triggerIntegration(integrationId, payload);
        }
        break;
      }
      case "create_ticket":
      case "block_domain":
      case "add_to_watchlist":
      case "generate_report":
        // Not implemented - requires external service integration
        logger.warn(`Action not implemented: ${action.type}`);
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
