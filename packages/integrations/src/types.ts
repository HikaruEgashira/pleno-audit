/**
 * @fileoverview Integrations Types
 *
 * Types for external service integrations and workflow automation.
 * Wiz-style integration with SIEM, ticketing, and notification systems.
 */

/**
 * Integration provider types
 */
export type IntegrationType =
  | "webhook" // Generic webhook
  | "slack" // Slack notifications
  | "teams" // Microsoft Teams
  | "email" // Email notifications
  | "jira" // Jira ticketing
  | "github" // GitHub issues
  | "pagerduty" // PagerDuty alerts
  | "splunk" // Splunk SIEM
  | "custom"; // Custom integration

/**
 * Integration status
 */
export type IntegrationStatus = "active" | "inactive" | "error" | "pending";

/**
 * Integration configuration
 */
export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  status: IntegrationStatus;
  config: IntegrationConfig;
  triggers: IntegrationTrigger[];
  createdAt: number;
  updatedAt: number;
  lastTriggered?: number;
  errorMessage?: string;
}

/**
 * Integration config based on type
 */
export type IntegrationConfig =
  | WebhookConfig
  | SlackConfig
  | EmailConfig
  | JiraConfig
  | GitHubConfig;

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  type: "webhook";
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
  secretKey?: string;
}

/**
 * Slack configuration
 */
export interface SlackConfig {
  type: "slack";
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  type: "email";
  recipients: string[];
  subject?: string;
  fromName?: string;
}

/**
 * Jira configuration
 */
export interface JiraConfig {
  type: "jira";
  baseUrl: string;
  projectKey: string;
  issueType: string;
  apiToken?: string;
}

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  type: "github";
  owner: string;
  repo: string;
  labels?: string[];
  token?: string;
}

/**
 * Integration trigger
 */
export interface IntegrationTrigger {
  event: TriggerEvent;
  conditions?: TriggerCondition[];
  enabled: boolean;
}

/**
 * Trigger events
 */
export type TriggerEvent =
  | "threat_detected" // New threat detected
  | "policy_violation" // Policy violation
  | "nrd_access" // NRD site accessed
  | "typosquat_detected" // Typosquat detected
  | "ai_data_leak" // Sensitive data sent to AI
  | "high_risk_extension" // High-risk extension detected
  | "daily_summary" // Daily summary report
  | "weekly_report"; // Weekly report

/**
 * Trigger condition
 */
export interface TriggerCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string | number;
}

/**
 * Integration event payload
 */
export interface IntegrationPayload {
  event: TriggerEvent;
  timestamp: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  domain?: string;
  data: Record<string, unknown>;
  source: string;
}

/**
 * Workflow automation
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: number;
  updatedAt: number;
  lastRun?: number;
  runCount: number;
}

/**
 * Workflow trigger
 */
export interface WorkflowTrigger {
  type: "event" | "schedule" | "manual";
  event?: TriggerEvent;
  schedule?: string; // Cron expression
  conditions?: TriggerCondition[];
}

/**
 * Workflow action
 */
export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  config: Record<string, unknown>;
  order: number;
}

/**
 * Workflow action types
 */
export type WorkflowActionType =
  | "send_notification" // Send notification
  | "create_ticket" // Create ticket
  | "block_domain" // Block domain
  | "add_to_watchlist" // Add to monitoring
  | "generate_report" // Generate report
  | "run_integration" // Trigger integration
  | "log_event"; // Log event

/**
 * Integration templates
 */
export const INTEGRATION_TEMPLATES: Array<{
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
}> = [
  {
    type: "slack",
    name: "Slack",
    description: "Slackチャンネルにセキュリティアラートを送信",
    icon: "slack",
  },
  {
    type: "webhook",
    name: "Webhook",
    description: "カスタムWebhookエンドポイントに通知",
    icon: "webhook",
  },
  {
    type: "email",
    name: "Email",
    description: "メールでセキュリティレポートを送信",
    icon: "mail",
  },
  {
    type: "jira",
    name: "Jira",
    description: "Jiraチケットを自動作成",
    icon: "ticket",
  },
  {
    type: "github",
    name: "GitHub Issues",
    description: "GitHubリポジトリにIssueを作成",
    icon: "github",
  },
];

/**
 * Workflow templates
 */
export const WORKFLOW_TEMPLATES: Array<{
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  actions: Omit<WorkflowAction, "id">[];
}> = [
  {
    name: "Critical Threat Alert",
    description: "重大な脅威検出時にSlackとメールで通知",
    trigger: {
      type: "event",
      event: "threat_detected",
      conditions: [{ field: "severity", operator: "equals", value: "critical" }],
    },
    actions: [
      { type: "send_notification", config: { channel: "slack" }, order: 1 },
      { type: "send_notification", config: { channel: "email" }, order: 2 },
      { type: "create_ticket", config: { priority: "high" }, order: 3 },
    ],
  },
  {
    name: "NRD Block",
    description: "NRDサイトへのアクセスを検出してブロック",
    trigger: {
      type: "event",
      event: "nrd_access",
    },
    actions: [
      { type: "block_domain", config: {}, order: 1 },
      { type: "log_event", config: {}, order: 2 },
    ],
  },
  {
    name: "Weekly Security Report",
    description: "毎週月曜日にセキュリティサマリーを送信",
    trigger: {
      type: "schedule",
      schedule: "0 9 * * 1", // Every Monday at 9 AM
    },
    actions: [
      { type: "generate_report", config: { format: "markdown" }, order: 1 },
      { type: "send_notification", config: { channel: "email" }, order: 2 },
    ],
  },
];
