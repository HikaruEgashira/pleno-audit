/**
 * @fileoverview Shadow IT Detection Types
 *
 * Types for detecting unauthorized SaaS and cloud services.
 * Inspired by Wiz's CNAPP Shadow IT discovery.
 */

/**
 * Service category
 */
export type ServiceCategory =
  | "storage" // Cloud storage (Dropbox, Google Drive, Box)
  | "collaboration" // Collaboration tools (Slack, Teams, Discord)
  | "development" // Dev tools (GitHub, GitLab, Jira)
  | "productivity" // Productivity (Notion, Trello, Asana)
  | "communication" // Email, messaging (Gmail, Outlook)
  | "ai" // AI services (ChatGPT, Claude, Gemini)
  | "analytics" // Analytics (GA, Mixpanel)
  | "marketing" // Marketing tools (Mailchimp, HubSpot)
  | "finance" // Finance (Stripe, PayPal)
  | "hr" // HR tools (Workday, BambooHR)
  | "security" // Security tools (1Password, LastPass)
  | "social" // Social media
  | "entertainment" // Entertainment
  | "other";

/**
 * Risk level for shadow IT
 */
export type ShadowITRisk =
  | "critical" // Data exfiltration risk
  | "high" // Sensitive data handling
  | "medium" // Business data access
  | "low" // Low risk
  | "info"; // Information only

/**
 * Known SaaS service definition
 */
export interface SaaSServiceDefinition {
  id: string;
  name: string;
  domains: string[];
  category: ServiceCategory;
  riskLevel: ShadowITRisk;
  dataTypes: string[]; // Types of data it handles
  features: {
    hasFileUpload: boolean;
    hasAuthentication: boolean;
    hasDataExport: boolean;
    isAIService: boolean;
  };
  complianceRisk: string[];
}

/**
 * Detected shadow IT service
 */
export interface DetectedShadowIT {
  serviceId: string;
  serviceName: string;
  domain: string;
  category: ServiceCategory;
  riskLevel: ShadowITRisk;
  detectedAt: number;
  lastSeenAt: number;
  accessCount: number;
  users: number; // Unique users (if trackable)
  dataExposure: {
    hasUploadedFiles: boolean;
    hasEnteredCredentials: boolean;
    hasSentPII: boolean;
    estimatedDataVolume: "low" | "medium" | "high";
  };
  approved: boolean;
  notes?: string;
}

/**
 * Shadow IT detection config
 */
export interface ShadowITConfig {
  enabled: boolean;
  approvedServices: string[]; // Approved service IDs
  blockedCategories: ServiceCategory[];
  alertOnNewService: boolean;
  trackDataExposure: boolean;
}

/**
 * Shadow IT summary
 */
export interface ShadowITSummary {
  totalServices: number;
  approvedServices: number;
  unapprovedServices: number;
  criticalRiskServices: number;
  highRiskServices: number;
  byCategory: Record<ServiceCategory, number>;
  topRisks: DetectedShadowIT[];
  recentlyDetected: DetectedShadowIT[];
}

/**
 * Default config
 */
export const DEFAULT_SHADOW_IT_CONFIG: ShadowITConfig = {
  enabled: true,
  approvedServices: [],
  blockedCategories: [],
  alertOnNewService: true,
  trackDataExposure: true,
};

/**
 * Known SaaS services database
 */
export const KNOWN_SAAS_SERVICES: SaaSServiceDefinition[] = [
  // Storage
  {
    id: "dropbox",
    name: "Dropbox",
    domains: ["dropbox.com", "dropboxapi.com"],
    category: "storage",
    riskLevel: "high",
    dataTypes: ["files", "documents", "media"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["data-residency", "encryption-at-rest"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    domains: ["drive.google.com", "docs.google.com", "sheets.google.com"],
    category: "storage",
    riskLevel: "high",
    dataTypes: ["files", "documents", "spreadsheets"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["data-residency"],
  },
  {
    id: "box",
    name: "Box",
    domains: ["box.com", "app.box.com"],
    category: "storage",
    riskLevel: "medium",
    dataTypes: ["files", "documents"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: [],
  },
  {
    id: "onedrive",
    name: "OneDrive",
    domains: ["onedrive.live.com", "1drv.ms"],
    category: "storage",
    riskLevel: "medium",
    dataTypes: ["files", "documents"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: [],
  },
  // Collaboration
  {
    id: "slack",
    name: "Slack",
    domains: ["slack.com", "app.slack.com"],
    category: "collaboration",
    riskLevel: "medium",
    dataTypes: ["messages", "files", "conversations"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["data-retention"],
  },
  {
    id: "discord",
    name: "Discord",
    domains: ["discord.com", "discordapp.com"],
    category: "collaboration",
    riskLevel: "high",
    dataTypes: ["messages", "voice", "files"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: false, isAIService: false },
    complianceRisk: ["data-retention", "no-enterprise-controls"],
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    domains: ["teams.microsoft.com", "teams.live.com"],
    category: "collaboration",
    riskLevel: "low",
    dataTypes: ["messages", "meetings", "files"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: [],
  },
  // AI Services
  {
    id: "chatgpt",
    name: "ChatGPT",
    domains: ["chat.openai.com", "chatgpt.com"],
    category: "ai",
    riskLevel: "critical",
    dataTypes: ["prompts", "code", "confidential-data"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: true },
    complianceRisk: ["data-training", "no-data-retention-control", "confidentiality"],
  },
  {
    id: "claude",
    name: "Claude",
    domains: ["claude.ai", "anthropic.com"],
    category: "ai",
    riskLevel: "critical",
    dataTypes: ["prompts", "code", "confidential-data"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: true },
    complianceRisk: ["data-training", "confidentiality"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    domains: ["gemini.google.com", "bard.google.com"],
    category: "ai",
    riskLevel: "critical",
    dataTypes: ["prompts", "code", "confidential-data"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: false, isAIService: true },
    complianceRisk: ["data-training", "confidentiality"],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    domains: ["copilot.github.com", "github.com/features/copilot"],
    category: "ai",
    riskLevel: "high",
    dataTypes: ["code", "comments"],
    features: { hasFileUpload: false, hasAuthentication: true, hasDataExport: false, isAIService: true },
    complianceRisk: ["code-leakage", "ip-concerns"],
  },
  // Development
  {
    id: "github",
    name: "GitHub",
    domains: ["github.com", "raw.githubusercontent.com"],
    category: "development",
    riskLevel: "high",
    dataTypes: ["code", "issues", "pull-requests"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["code-exposure", "public-repos"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    domains: ["gitlab.com"],
    category: "development",
    riskLevel: "high",
    dataTypes: ["code", "issues", "ci-cd"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["code-exposure"],
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    domains: ["bitbucket.org"],
    category: "development",
    riskLevel: "medium",
    dataTypes: ["code", "issues"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: [],
  },
  // Productivity
  {
    id: "notion",
    name: "Notion",
    domains: ["notion.so", "notion.site"],
    category: "productivity",
    riskLevel: "high",
    dataTypes: ["documents", "databases", "wikis"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["public-pages", "data-residency"],
  },
  {
    id: "trello",
    name: "Trello",
    domains: ["trello.com"],
    category: "productivity",
    riskLevel: "medium",
    dataTypes: ["tasks", "boards", "attachments"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["public-boards"],
  },
  {
    id: "airtable",
    name: "Airtable",
    domains: ["airtable.com"],
    category: "productivity",
    riskLevel: "medium",
    dataTypes: ["databases", "forms", "attachments"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["public-views"],
  },
  // Security
  {
    id: "1password",
    name: "1Password",
    domains: ["1password.com", "my.1password.com"],
    category: "security",
    riskLevel: "low",
    dataTypes: ["passwords", "secrets"],
    features: { hasFileUpload: false, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: [],
  },
  {
    id: "lastpass",
    name: "LastPass",
    domains: ["lastpass.com"],
    category: "security",
    riskLevel: "medium",
    dataTypes: ["passwords", "secrets"],
    features: { hasFileUpload: false, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: ["breach-history"],
  },
  // Social
  {
    id: "twitter",
    name: "Twitter/X",
    domains: ["twitter.com", "x.com"],
    category: "social",
    riskLevel: "medium",
    dataTypes: ["posts", "messages"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: false, isAIService: false },
    complianceRisk: ["public-data-leak"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    domains: ["linkedin.com"],
    category: "social",
    riskLevel: "low",
    dataTypes: ["profiles", "messages"],
    features: { hasFileUpload: true, hasAuthentication: true, hasDataExport: true, isAIService: false },
    complianceRisk: [],
  },
];
