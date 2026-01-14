/**
 * @fileoverview Permission Analyzer Types
 *
 * CIEM-style permission analysis for browser extensions and websites.
 * Analyzes permissions, access patterns, and identifies excessive privileges.
 */

/**
 * Chrome extension permission types
 */
export type ExtensionPermissionType =
  | "all_urls" // Access to all URLs
  | "tabs" // Tab information
  | "history" // Browsing history
  | "cookies" // Cookie access
  | "storage" // Local storage
  | "webRequest" // Network request interception
  | "webRequestBlocking" // Block network requests
  | "downloads" // Download management
  | "bookmarks" // Bookmark access
  | "notifications" // System notifications
  | "clipboardRead" // Read clipboard
  | "clipboardWrite" // Write clipboard
  | "geolocation" // Location access
  | "identity" // OAuth identity
  | "management" // Extension management
  | "nativeMessaging" // Native app communication
  | "privacy" // Privacy settings
  | "proxy" // Proxy settings
  | "scripting" // Script injection
  | "activeTab" // Active tab only
  | "host_permission" // Specific host access
  | "unknown";

/**
 * Permission risk level
 */
export type PermissionRisk = "critical" | "high" | "medium" | "low" | "minimal";

/**
 * Permission category
 */
export type PermissionCategory =
  | "data_access" // Access to user data
  | "network" // Network capabilities
  | "system" // System-level access
  | "browser" // Browser functionality
  | "identity"; // User identity

/**
 * Extension permission details
 */
export interface ExtensionPermission {
  type: ExtensionPermissionType;
  category: PermissionCategory;
  risk: PermissionRisk;
  description: string;
  justification?: string;
  used: boolean;
  usageCount: number;
  lastUsed?: number;
}

/**
 * Website permission types (Web API)
 */
export type WebPermissionType =
  | "camera"
  | "microphone"
  | "geolocation"
  | "notifications"
  | "clipboard-read"
  | "clipboard-write"
  | "storage-access"
  | "screen-wake-lock"
  | "midi"
  | "bluetooth"
  | "usb"
  | "serial"
  | "hid"
  | "payment-handler"
  | "background-sync"
  | "persistent-storage";

/**
 * Website permission details
 */
export interface WebPermission {
  type: WebPermissionType;
  domain: string;
  status: "granted" | "denied" | "prompt";
  risk: PermissionRisk;
  grantedAt?: number;
  lastUsed?: number;
}

/**
 * Extension analysis result
 */
export interface ExtensionAnalysis {
  id: string;
  name: string;
  version: string;
  permissions: ExtensionPermission[];
  hostPermissions: string[];
  riskScore: number;
  riskLevel: PermissionRisk;
  findings: PermissionFinding[];
  recommendations: string[];
  analyzedAt: number;
}

/**
 * Permission finding (issue or concern)
 */
export interface PermissionFinding {
  id: string;
  type: FindingType;
  severity: PermissionRisk;
  title: string;
  description: string;
  permission?: ExtensionPermissionType | WebPermissionType;
  recommendation: string;
}

/**
 * Finding types
 */
export type FindingType =
  | "excessive_permission" // Permission not needed
  | "unused_permission" // Declared but never used
  | "dangerous_combination" // Risky permission combination
  | "all_urls_access" // Broad URL access
  | "sensitive_data_access" // Access to sensitive data
  | "blocking_capability" // Can block user actions
  | "identity_access" // Access to user identity
  | "history_access"; // Access to browsing history

/**
 * Permission summary for dashboard
 */
export interface PermissionSummary {
  totalExtensions: number;
  totalPermissions: number;
  criticalFindings: number;
  highRiskExtensions: number;
  unusedPermissions: number;
  extensionsByRisk: Record<PermissionRisk, number>;
  permissionsByCategory: Record<PermissionCategory, number>;
  topRiskyPermissions: Array<{
    permission: ExtensionPermissionType;
    count: number;
    risk: PermissionRisk;
  }>;
}

/**
 * Permission baseline for comparison
 */
export interface PermissionBaseline {
  extensionId: string;
  baselinePermissions: ExtensionPermissionType[];
  baselineHosts: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Permission change event
 */
export interface PermissionChange {
  extensionId: string;
  extensionName: string;
  changeType: "added" | "removed";
  permission: ExtensionPermissionType | string;
  timestamp: number;
  risk: PermissionRisk;
}

/**
 * Permission metadata for risk calculation
 */
export const PERMISSION_METADATA: Record<
  ExtensionPermissionType,
  {
    category: PermissionCategory;
    risk: PermissionRisk;
    description: string;
  }
> = {
  all_urls: {
    category: "data_access",
    risk: "critical",
    description: "Access to all websites",
  },
  tabs: {
    category: "browser",
    risk: "medium",
    description: "Access to tab URLs and titles",
  },
  history: {
    category: "data_access",
    risk: "high",
    description: "Access to browsing history",
  },
  cookies: {
    category: "data_access",
    risk: "high",
    description: "Read and modify cookies",
  },
  storage: {
    category: "browser",
    risk: "low",
    description: "Local data storage",
  },
  webRequest: {
    category: "network",
    risk: "high",
    description: "Monitor network requests",
  },
  webRequestBlocking: {
    category: "network",
    risk: "critical",
    description: "Block or modify network requests",
  },
  downloads: {
    category: "system",
    risk: "medium",
    description: "Manage downloads",
  },
  bookmarks: {
    category: "data_access",
    risk: "medium",
    description: "Access bookmarks",
  },
  notifications: {
    category: "browser",
    risk: "low",
    description: "Show notifications",
  },
  clipboardRead: {
    category: "data_access",
    risk: "high",
    description: "Read clipboard contents",
  },
  clipboardWrite: {
    category: "browser",
    risk: "low",
    description: "Write to clipboard",
  },
  geolocation: {
    category: "identity",
    risk: "high",
    description: "Access location",
  },
  identity: {
    category: "identity",
    risk: "critical",
    description: "Access Google identity",
  },
  management: {
    category: "system",
    risk: "critical",
    description: "Manage other extensions",
  },
  nativeMessaging: {
    category: "system",
    risk: "critical",
    description: "Communicate with native apps",
  },
  privacy: {
    category: "system",
    risk: "high",
    description: "Modify privacy settings",
  },
  proxy: {
    category: "network",
    risk: "critical",
    description: "Control proxy settings",
  },
  scripting: {
    category: "data_access",
    risk: "high",
    description: "Inject scripts into pages",
  },
  activeTab: {
    category: "browser",
    risk: "low",
    description: "Access active tab only when clicked",
  },
  host_permission: {
    category: "data_access",
    risk: "medium",
    description: "Access specific hosts",
  },
  unknown: {
    category: "browser",
    risk: "low",
    description: "Unknown permission",
  },
};

/**
 * Dangerous permission combinations
 */
export const DANGEROUS_COMBINATIONS: Array<{
  permissions: ExtensionPermissionType[];
  severity: PermissionRisk;
  warning: string;
}> = [
  {
    permissions: ["webRequest", "all_urls"],
    severity: "critical",
    warning: "Can intercept all network traffic",
  },
  {
    permissions: ["cookies", "all_urls"],
    severity: "critical",
    warning: "Can steal cookies from any website",
  },
  {
    permissions: ["history", "tabs"],
    severity: "high",
    warning: "Can track complete browsing behavior",
  },
  {
    permissions: ["scripting", "all_urls"],
    severity: "critical",
    warning: "Can inject code into any website",
  },
  {
    permissions: ["clipboardRead", "all_urls"],
    severity: "high",
    warning: "Can read clipboard on any website",
  },
  {
    permissions: ["identity", "cookies"],
    severity: "critical",
    warning: "Can access identity and session data",
  },
  {
    permissions: ["downloads", "scripting"],
    severity: "high",
    warning: "Can download files via injected scripts",
  },
  {
    permissions: ["nativeMessaging", "all_urls"],
    severity: "critical",
    warning: "Can exfiltrate data to native applications",
  },
];
