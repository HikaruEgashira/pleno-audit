/**
 * @fileoverview Permission Analyzer
 *
 * Analyzes browser extension permissions for security risks.
 * Wiz CIEM-style entitlement analysis for browser environment.
 */

import type {
  ExtensionPermissionType,
  ExtensionPermission,
  ExtensionAnalysis,
  PermissionFinding,
  PermissionSummary,
  PermissionRisk,
  PermissionChange,
  PermissionBaseline,
} from "./types.js";
import {
  PERMISSION_METADATA,
  DANGEROUS_COMBINATIONS,
} from "./types.js";

export interface PermissionAnalyzerStore {
  getBaseline(extensionId: string): Promise<PermissionBaseline | null>;
  saveBaseline(baseline: PermissionBaseline): Promise<void>;
  getAnalysis(extensionId: string): Promise<ExtensionAnalysis | null>;
  saveAnalysis(analysis: ExtensionAnalysis): Promise<void>;
  getAllAnalyses(): Promise<ExtensionAnalysis[]>;
}

export interface PermissionChangeListener {
  (change: PermissionChange): void;
}

export interface PermissionAnalyzer {
  analyzeExtension(manifest: ExtensionManifest): ExtensionAnalysis;
  compareWithBaseline(
    analysis: ExtensionAnalysis,
    baseline: PermissionBaseline
  ): PermissionChange[];
  getSummary(): Promise<PermissionSummary>;
  subscribe(listener: PermissionChangeListener): () => void;
}

/**
 * Chrome extension manifest (simplified)
 */
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
}

/**
 * Create in-memory store
 */
export function createInMemoryPermissionStore(): PermissionAnalyzerStore {
  const baselines = new Map<string, PermissionBaseline>();
  const analyses = new Map<string, ExtensionAnalysis>();

  return {
    async getBaseline(extensionId: string) {
      return baselines.get(extensionId) || null;
    },
    async saveBaseline(baseline: PermissionBaseline) {
      baselines.set(baseline.extensionId, baseline);
    },
    async getAnalysis(extensionId: string) {
      return analyses.get(extensionId) || null;
    },
    async saveAnalysis(analysis: ExtensionAnalysis) {
      analyses.set(analysis.id, analysis);
    },
    async getAllAnalyses() {
      return Array.from(analyses.values());
    },
  };
}

/**
 * Create permission analyzer
 */
export function createPermissionAnalyzer(
  store?: PermissionAnalyzerStore
): PermissionAnalyzer {
  const internalStore = store || createInMemoryPermissionStore();
  const listeners = new Set<PermissionChangeListener>();

  /**
   * Parse permission string to type
   */
  function parsePermission(perm: string): ExtensionPermissionType {
    // Check if it's a host permission pattern
    if (
      perm.includes("://") ||
      perm.startsWith("<all_urls>") ||
      perm.includes("*")
    ) {
      if (perm === "<all_urls>" || perm.includes("*://*/*")) {
        return "all_urls";
      }
      return "host_permission";
    }

    // Map known permissions
    const knownPermissions: Record<string, ExtensionPermissionType> = {
      tabs: "tabs",
      history: "history",
      cookies: "cookies",
      storage: "storage",
      webRequest: "webRequest",
      webRequestBlocking: "webRequestBlocking",
      downloads: "downloads",
      bookmarks: "bookmarks",
      notifications: "notifications",
      clipboardRead: "clipboardRead",
      clipboardWrite: "clipboardWrite",
      geolocation: "geolocation",
      identity: "identity",
      management: "management",
      nativeMessaging: "nativeMessaging",
      privacy: "privacy",
      proxy: "proxy",
      scripting: "scripting",
      activeTab: "activeTab",
    };

    return knownPermissions[perm] || "unknown";
  }

  /**
   * Analyze extension permissions
   */
  function analyzeExtension(manifest: ExtensionManifest): ExtensionAnalysis {
    const allPermissions = [
      ...(manifest.permissions || []),
      ...(manifest.optional_permissions || []),
      ...(manifest.host_permissions || []),
    ];

    const permissions: ExtensionPermission[] = [];
    const hostPermissions: string[] = [];
    const findings: PermissionFinding[] = [];
    const grantedTypes: ExtensionPermissionType[] = [];

    // Parse and categorize permissions
    for (const perm of allPermissions) {
      const permType = parsePermission(perm);

      if (permType === "host_permission") {
        hostPermissions.push(perm);
        continue;
      }

      if (permType === "all_urls") {
        hostPermissions.push("<all_urls>");
      }

      const metadata = PERMISSION_METADATA[permType];
      grantedTypes.push(permType);

      permissions.push({
        type: permType,
        category: metadata.category,
        risk: metadata.risk,
        description: metadata.description,
        used: false, // Would need runtime tracking
        usageCount: 0,
      });
    }

    // Check for dangerous combinations
    for (const combo of DANGEROUS_COMBINATIONS) {
      const hasAll = combo.permissions.every((p) => grantedTypes.includes(p));
      if (hasAll) {
        findings.push({
          id: `combo:${combo.permissions.join("+")}`,
          type: "dangerous_combination",
          severity: combo.severity,
          title: "Dangerous Permission Combination",
          description: combo.warning,
          recommendation: `Review if all these permissions are necessary: ${combo.permissions.join(", ")}`,
        });
      }
    }

    // Check for excessive permissions
    if (grantedTypes.includes("all_urls")) {
      findings.push({
        id: "excessive:all_urls",
        type: "all_urls_access",
        severity: "critical",
        title: "Unrestricted URL Access",
        description: "Extension can access all websites",
        permission: "all_urls",
        recommendation:
          "Consider limiting to specific domains the extension actually needs",
      });
    }

    if (grantedTypes.includes("history")) {
      findings.push({
        id: "sensitive:history",
        type: "history_access",
        severity: "high",
        title: "Browsing History Access",
        description: "Extension can read complete browsing history",
        permission: "history",
        recommendation: "Ensure extension has legitimate need for history access",
      });
    }

    if (grantedTypes.includes("identity")) {
      findings.push({
        id: "identity:access",
        type: "identity_access",
        severity: "critical",
        title: "Identity Access",
        description: "Extension can access user's Google identity",
        permission: "identity",
        recommendation:
          "Verify OAuth scope and ensure minimal identity access",
      });
    }

    if (grantedTypes.includes("webRequestBlocking")) {
      findings.push({
        id: "blocking:webRequest",
        type: "blocking_capability",
        severity: "critical",
        title: "Request Blocking Capability",
        description: "Extension can block or modify network requests",
        permission: "webRequestBlocking",
        recommendation:
          "Review blocking rules to ensure no malicious behavior",
      });
    }

    // Calculate risk score
    let riskScore = 0;
    const riskWeights: Record<PermissionRisk, number> = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      minimal: 1,
    };

    for (const perm of permissions) {
      riskScore += riskWeights[perm.risk];
    }

    // Additional score for findings
    for (const finding of findings) {
      riskScore += riskWeights[finding.severity];
    }

    // Normalize to 100
    riskScore = Math.min(100, riskScore);

    // Determine risk level
    let riskLevel: PermissionRisk = "minimal";
    if (riskScore >= 80) riskLevel = "critical";
    else if (riskScore >= 60) riskLevel = "high";
    else if (riskScore >= 40) riskLevel = "medium";
    else if (riskScore >= 20) riskLevel = "low";

    // Generate recommendations
    const recommendations: string[] = [];

    if (grantedTypes.includes("all_urls")) {
      recommendations.push(
        "Replace <all_urls> with specific host permissions for domains the extension actually uses"
      );
    }

    if (permissions.length > 10) {
      recommendations.push(
        "Consider reducing the number of permissions to minimize attack surface"
      );
    }

    const criticalPerms = permissions.filter((p) => p.risk === "critical");
    if (criticalPerms.length > 0) {
      recommendations.push(
        `Review critical permissions: ${criticalPerms.map((p) => p.type).join(", ")}`
      );
    }

    if (hostPermissions.length > 10) {
      recommendations.push(
        "Large number of host permissions detected. Consider using activeTab instead"
      );
    }

    const analysis: ExtensionAnalysis = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      permissions,
      hostPermissions,
      riskScore,
      riskLevel,
      findings,
      recommendations,
      analyzedAt: Date.now(),
    };

    // Save analysis
    internalStore.saveAnalysis(analysis);

    return analysis;
  }

  /**
   * Compare analysis with baseline
   */
  function compareWithBaseline(
    analysis: ExtensionAnalysis,
    baseline: PermissionBaseline
  ): PermissionChange[] {
    const changes: PermissionChange[] = [];
    const currentPerms = new Set(analysis.permissions.map((p) => p.type));
    const baselinePerms = new Set(baseline.baselinePermissions);

    // Check for added permissions
    for (const perm of currentPerms) {
      if (!baselinePerms.has(perm)) {
        const metadata = PERMISSION_METADATA[perm];
        const change: PermissionChange = {
          extensionId: analysis.id,
          extensionName: analysis.name,
          changeType: "added",
          permission: perm,
          timestamp: Date.now(),
          risk: metadata.risk,
        };
        changes.push(change);

        // Notify listeners
        for (const listener of listeners) {
          listener(change);
        }
      }
    }

    // Check for removed permissions
    for (const perm of baselinePerms) {
      if (!currentPerms.has(perm)) {
        const metadata = PERMISSION_METADATA[perm];
        const change: PermissionChange = {
          extensionId: analysis.id,
          extensionName: analysis.name,
          changeType: "removed",
          permission: perm,
          timestamp: Date.now(),
          risk: metadata.risk,
        };
        changes.push(change);

        for (const listener of listeners) {
          listener(change);
        }
      }
    }

    // Check host permissions
    const currentHosts = new Set(analysis.hostPermissions);
    const baselineHosts = new Set(baseline.baselineHosts);

    for (const host of currentHosts) {
      if (!baselineHosts.has(host)) {
        const change: PermissionChange = {
          extensionId: analysis.id,
          extensionName: analysis.name,
          changeType: "added",
          permission: `host:${host}`,
          timestamp: Date.now(),
          risk: host.includes("*") ? "high" : "medium",
        };
        changes.push(change);

        for (const listener of listeners) {
          listener(change);
        }
      }
    }

    return changes;
  }

  /**
   * Get permission summary
   */
  async function getSummary(): Promise<PermissionSummary> {
    const analyses = await internalStore.getAllAnalyses();

    const summary: PermissionSummary = {
      totalExtensions: analyses.length,
      totalPermissions: 0,
      criticalFindings: 0,
      highRiskExtensions: 0,
      unusedPermissions: 0,
      extensionsByRisk: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        minimal: 0,
      },
      permissionsByCategory: {
        data_access: 0,
        network: 0,
        system: 0,
        browser: 0,
        identity: 0,
      },
      topRiskyPermissions: [],
    };

    const permissionCounts: Record<ExtensionPermissionType, number> = {} as any;

    for (const analysis of analyses) {
      summary.totalPermissions += analysis.permissions.length;
      summary.extensionsByRisk[analysis.riskLevel]++;

      if (analysis.riskLevel === "critical" || analysis.riskLevel === "high") {
        summary.highRiskExtensions++;
      }

      for (const finding of analysis.findings) {
        if (finding.severity === "critical") {
          summary.criticalFindings++;
        }
      }

      for (const perm of analysis.permissions) {
        summary.permissionsByCategory[perm.category]++;

        if (!perm.used) {
          summary.unusedPermissions++;
        }

        permissionCounts[perm.type] = (permissionCounts[perm.type] || 0) + 1;
      }
    }

    // Calculate top risky permissions
    const riskyPerms = Object.entries(permissionCounts)
      .filter(([type]) => {
        const metadata = PERMISSION_METADATA[type as ExtensionPermissionType];
        return (
          metadata &&
          (metadata.risk === "critical" || metadata.risk === "high")
        );
      })
      .map(([type, count]) => ({
        permission: type as ExtensionPermissionType,
        count,
        risk: PERMISSION_METADATA[type as ExtensionPermissionType].risk,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    summary.topRiskyPermissions = riskyPerms;

    return summary;
  }

  /**
   * Subscribe to permission changes
   */
  function subscribe(listener: PermissionChangeListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    analyzeExtension,
    compareWithBaseline,
    getSummary,
    subscribe,
  };
}
