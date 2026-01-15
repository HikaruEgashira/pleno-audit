/**
 * @fileoverview Integrations Package
 *
 * External service integrations and workflow automation.
 * Wiz-style integration with SIEM, ticketing, and notification systems.
 */

// Types
export type {
  IntegrationType,
  IntegrationStatus,
  Integration,
  IntegrationConfig,
  WebhookConfig,
  SlackConfig,
  EmailConfig,
  JiraConfig,
  GitHubConfig,
  WizConfig,
  IntegrationTrigger,
  TriggerEvent,
  TriggerCondition,
  IntegrationPayload,
  Workflow,
  WorkflowTrigger,
  WorkflowAction,
  WorkflowActionType,
} from "./types.js";

export { INTEGRATION_TEMPLATES, WORKFLOW_TEMPLATES } from "./types.js";

// Manager
export {
  createIntegrationManager,
  createInMemoryIntegrationStore,
  type IntegrationManager,
  type IntegrationStore,
} from "./manager.js";
