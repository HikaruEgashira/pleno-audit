/**
 * @fileoverview Alert Manager
 *
 * Manages security alerts, notifications, and alert lifecycle.
 */

import type {
  SecurityAlert,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  AlertConfig,
  AlertRule,
  AlertAction,
  AlertDetails,
} from "./types.js";

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Alert store interface
 */
export interface AlertStore {
  getAlerts(options?: { limit?: number; status?: AlertStatus[] }): Promise<SecurityAlert[]>;
  addAlert(alert: SecurityAlert): Promise<void>;
  updateAlert(id: string, updates: Partial<SecurityAlert>): Promise<void>;
  deleteAlert(id: string): Promise<void>;
  getAlertCount(status?: AlertStatus[]): Promise<number>;
}

/**
 * In-memory alert store
 */
export function createInMemoryAlertStore(): AlertStore {
  const alerts: Map<string, SecurityAlert> = new Map();

  return {
    async getAlerts(options) {
      let result = Array.from(alerts.values());

      if (options?.status) {
        result = result.filter((a) => options.status!.includes(a.status));
      }

      result.sort((a, b) => b.timestamp - a.timestamp);

      if (options?.limit) {
        result = result.slice(0, options.limit);
      }

      return result;
    },

    async addAlert(alert) {
      alerts.set(alert.id, alert);
    },

    async updateAlert(id, updates) {
      const alert = alerts.get(id);
      if (alert) {
        alerts.set(id, { ...alert, ...updates });
      }
    },

    async deleteAlert(id) {
      alerts.delete(id);
    },

    async getAlertCount(status) {
      if (!status) return alerts.size;
      return Array.from(alerts.values()).filter((a) => status.includes(a.status)).length;
    },
  };
}

/**
 * Alert event listener
 */
export type AlertListener = (alert: SecurityAlert) => void;

/**
 * Create alert manager
 */
export function createAlertManager(
  config: AlertConfig = {
    enabled: true,
    showNotifications: true,
    playSound: false,
    rules: [],
    severityFilter: ["critical", "high"],
  },
  store?: AlertStore
) {
  const alertStore = store || createInMemoryAlertStore();
  const listeners: Set<AlertListener> = new Set();
  const rules: Map<string, AlertRule> = new Map();

  // Initialize default rules
  const defaultRules: AlertRule[] = [
    {
      id: "nrd-high",
      name: "High confidence NRD",
      enabled: true,
      category: "nrd",
      condition: { type: "always" },
      severity: "high",
      actions: [
        { id: "investigate", label: "調査", type: "investigate" },
        { id: "dismiss", label: "無視", type: "dismiss" },
      ],
    },
    {
      id: "typosquat-high",
      name: "High confidence typosquat",
      enabled: true,
      category: "typosquat",
      condition: { type: "always" },
      severity: "critical",
      actions: [
        { id: "block", label: "ブロック", type: "block" },
        { id: "report", label: "報告", type: "report" },
      ],
    },
  ];

  for (const rule of [...defaultRules, ...config.rules]) {
    rules.set(rule.id, rule);
  }

  /**
   * Create and emit an alert
   */
  async function createAlert(params: {
    category: AlertCategory;
    severity: AlertSeverity;
    title: string;
    description: string;
    domain: string;
    details: AlertDetails;
    actions?: AlertAction[];
  }): Promise<SecurityAlert | null> {
    if (!config.enabled) return null;

    // Check severity filter
    const severityOrder: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];
    const minSeverityIndex = Math.min(
      ...config.severityFilter.map((s) => severityOrder.indexOf(s))
    );
    const alertSeverityIndex = severityOrder.indexOf(params.severity);

    if (alertSeverityIndex > minSeverityIndex) {
      return null; // Below minimum severity
    }

    const alert: SecurityAlert = {
      id: generateAlertId(),
      category: params.category,
      severity: params.severity,
      status: "new",
      title: params.title,
      description: params.description,
      domain: params.domain,
      timestamp: Date.now(),
      details: params.details,
      actions: params.actions || getDefaultActions(params.category),
    };

    await alertStore.addAlert(alert);

    // Notify listeners
    for (const listener of listeners) {
      try {
        listener(alert);
      } catch {
        // Ignore listener errors
      }
    }

    return alert;
  }

  /**
   * Get default actions for category
   */
  function getDefaultActions(category: AlertCategory): AlertAction[] {
    const rule = Array.from(rules.values()).find(
      (r) => r.category === category && r.enabled
    );
    return rule?.actions || [
      { id: "investigate", label: "調査", type: "investigate" },
      { id: "dismiss", label: "無視", type: "dismiss" },
    ];
  }

  /**
   * Create NRD alert
   */
  async function alertNRD(params: {
    domain: string;
    domainAge: number | null;
    registrationDate: string | null;
    confidence: "high" | "medium" | "low" | "unknown";
  }): Promise<SecurityAlert | null> {
    const severity: AlertSeverity =
      params.confidence === "high" ? "high" : "medium";

    return createAlert({
      category: "nrd",
      severity,
      title: `NRD検出: ${params.domain}`,
      description: `新規登録ドメイン（${params.domainAge !== null ? `${params.domainAge}日前` : "日数不明"}）`,
      domain: params.domain,
      details: {
        type: "nrd",
        domainAge: params.domainAge,
        registrationDate: params.registrationDate,
        confidence: params.confidence,
      },
    });
  }

  /**
   * Create typosquat alert
   */
  async function alertTyposquat(params: {
    domain: string;
    targetDomain?: string;
    homoglyphCount: number;
    confidence: "high" | "medium" | "low" | "none";
  }): Promise<SecurityAlert | null> {
    if (params.confidence === "none") return null;

    const severity: AlertSeverity =
      params.confidence === "high" ? "critical" : "high";

    return createAlert({
      category: "typosquat",
      severity,
      title: `タイポスクワット検出: ${params.domain}`,
      description: params.targetDomain
        ? `${params.targetDomain}の偽装の可能性`
        : `ホモグリフ ${params.homoglyphCount}個検出`,
      domain: params.domain,
      details: {
        type: "typosquat",
        targetDomain: params.targetDomain,
        homoglyphCount: params.homoglyphCount,
        confidence: params.confidence,
      },
    });
  }

  /**
   * Create AI sensitive data alert
   */
  async function alertAISensitive(params: {
    domain: string;
    provider: string;
    model?: string;
    dataTypes: string[];
  }): Promise<SecurityAlert | null> {
    const hasCredentials = params.dataTypes.includes("credentials");
    const severity: AlertSeverity = hasCredentials ? "critical" : "high";

    return createAlert({
      category: "ai_sensitive",
      severity,
      title: `機密情報をAIに送信: ${params.domain}`,
      description: `${params.provider}に${params.dataTypes.join(", ")}を送信`,
      domain: params.domain,
      details: {
        type: "ai_sensitive",
        provider: params.provider,
        model: params.model,
        dataTypes: params.dataTypes,
      },
    });
  }

  /**
   * Create Shadow AI alert
   */
  async function alertShadowAI(params: {
    domain: string;
    provider: string;
    providerDisplayName: string;
    category: "major" | "enterprise" | "open_source" | "regional" | "specialized";
    riskLevel: "low" | "medium" | "high";
    confidence: "high" | "medium" | "low";
    model?: string;
  }): Promise<SecurityAlert | null> {
    // Determine severity based on risk level and category
    let severity: AlertSeverity;
    if (params.provider === "unknown") {
      severity = "high";
    } else if (params.category === "regional") {
      severity = params.riskLevel === "high" ? "high" : "medium";
    } else {
      severity = params.riskLevel === "high" ? "high" : "medium";
    }

    const isUnknown = params.provider === "unknown";
    const title = isUnknown
      ? `未知のAIサービス検出: ${params.domain}`
      : `Shadow AI検出: ${params.providerDisplayName}`;

    const description = isUnknown
      ? "未承認のAIサービスへのアクセスを検出しました"
      : `${params.providerDisplayName}（${params.category}）へのアクセスを検出`;

    return createAlert({
      category: "shadow_ai",
      severity,
      title,
      description,
      domain: params.domain,
      details: {
        type: "shadow_ai",
        provider: params.provider,
        providerDisplayName: params.providerDisplayName,
        category: params.category,
        riskLevel: params.riskLevel,
        confidence: params.confidence,
        model: params.model,
      },
    });
  }

  /**
   * Create extension risk alert
   */
  async function alertExtension(params: {
    extensionId: string;
    extensionName: string;
    riskLevel: "critical" | "high" | "medium" | "low";
    riskScore: number;
    flags: string[];
    requestCount: number;
    targetDomains: string[];
  }): Promise<SecurityAlert | null> {
    // 危険度に基づいてseverityを決定
    let severity: AlertSeverity;
    if (params.riskLevel === "critical") {
      severity = "critical";
    } else if (params.riskLevel === "high") {
      severity = "high";
    } else if (params.riskLevel === "medium") {
      severity = "medium";
    } else {
      severity = "low";
    }

    const flagsPreview = params.flags.slice(0, 2).join(", ");

    return createAlert({
      category: "extension",
      severity,
      title: `危険な拡張機能: ${params.extensionName}`,
      description: flagsPreview
        ? `リスクフラグ: ${flagsPreview}`
        : `リスクスコア: ${params.riskScore}`,
      domain: "chrome-extension://" + params.extensionId,
      details: {
        type: "extension",
        extensionId: params.extensionId,
        extensionName: params.extensionName,
        requestCount: params.requestCount,
        targetDomains: params.targetDomains,
      },
    });
  }

  /**
   * Update alert status
   */
  async function updateAlertStatus(
    alertId: string,
    status: AlertStatus
  ): Promise<void> {
    await alertStore.updateAlert(alertId, { status });
  }

  /**
   * Get alerts
   */
  async function getAlerts(options?: {
    limit?: number;
    status?: AlertStatus[];
  }): Promise<SecurityAlert[]> {
    return alertStore.getAlerts(options);
  }

  /**
   * Get alert count
   */
  async function getAlertCount(status?: AlertStatus[]): Promise<number> {
    return alertStore.getAlertCount(status);
  }

  /**
   * Subscribe to new alerts
   */
  function subscribe(listener: AlertListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Acknowledge all new alerts
   */
  async function acknowledgeAll(): Promise<void> {
    const newAlerts = await alertStore.getAlerts({ status: ["new"] });
    for (const alert of newAlerts) {
      await alertStore.updateAlert(alert.id, { status: "acknowledged" });
    }
  }

  /**
   * Delete resolved alerts
   */
  async function clearResolved(): Promise<void> {
    const resolved = await alertStore.getAlerts({
      status: ["resolved", "dismissed"],
    });
    for (const alert of resolved) {
      await alertStore.deleteAlert(alert.id);
    }
  }

  return {
    createAlert,
    alertNRD,
    alertTyposquat,
    alertAISensitive,
    alertShadowAI,
    alertExtension,
    updateAlertStatus,
    getAlerts,
    getAlertCount,
    subscribe,
    acknowledgeAll,
    clearResolved,
  };
}

export type AlertManager = ReturnType<typeof createAlertManager>;
