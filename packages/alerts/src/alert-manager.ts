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

  /**
   * Create data exfiltration alert
   */
  async function alertDataExfiltration(params: {
    sourceDomain: string;
    targetDomain: string;
    bodySize: number;
    method: string;
    initiator: string;
  }): Promise<SecurityAlert | null> {
    const sizeKB = Math.round(params.bodySize / 1024);
    const severity: AlertSeverity = sizeKB > 500 ? "critical" : "high";

    return createAlert({
      category: "data_exfiltration",
      severity,
      title: `大量データ送信検出: ${params.targetDomain}`,
      description: `${params.sourceDomain}から${sizeKB}KBのデータを${params.targetDomain}に送信`,
      domain: params.targetDomain,
      details: {
        type: "data_exfiltration",
        sourceDomain: params.sourceDomain,
        targetDomain: params.targetDomain,
        bodySize: params.bodySize,
        sizeKB,
        method: params.method,
        initiator: params.initiator,
      },
    });
  }

  /**
   * Create credential theft alert
   */
  async function alertCredentialTheft(params: {
    sourceDomain: string;
    targetDomain: string;
    formAction: string;
    isSecure: boolean;
    isCrossOrigin: boolean;
    fieldType: string;
    risks: string[];
  }): Promise<SecurityAlert | null> {
    // Determine severity based on risks
    const hasInsecureProtocol = params.risks.includes("insecure_protocol");
    const severity: AlertSeverity = hasInsecureProtocol ? "critical" : "high";

    const riskDescriptions: string[] = [];
    if (hasInsecureProtocol) {
      riskDescriptions.push("非HTTPS通信");
    }
    if (params.isCrossOrigin) {
      riskDescriptions.push("クロスオリジン送信");
    }

    return createAlert({
      category: "credential_theft",
      severity,
      title: `認証情報リスク: ${params.targetDomain}`,
      description: `${params.fieldType}フィールドが${riskDescriptions.join(", ")}で送信されます`,
      domain: params.targetDomain,
      details: {
        type: "credential_theft",
        sourceDomain: params.sourceDomain,
        targetDomain: params.targetDomain,
        formAction: params.formAction,
        isSecure: params.isSecure,
        isCrossOrigin: params.isCrossOrigin,
        fieldType: params.fieldType,
        risks: params.risks,
      },
    });
  }

  /**
   * Create supply chain risk alert
   */
  async function alertSupplyChainRisk(params: {
    pageDomain: string;
    resourceUrl: string;
    resourceDomain: string;
    resourceType: string;
    hasIntegrity: boolean;
    hasCrossorigin: boolean;
    isCDN: boolean;
    risks: string[];
  }): Promise<SecurityAlert | null> {
    // Determine severity based on risks
    const isCDNWithoutSRI = params.isCDN && !params.hasIntegrity;
    const severity: AlertSeverity = isCDNWithoutSRI ? "high" : "medium";

    const riskDescriptions: string[] = [];
    if (!params.hasIntegrity) {
      riskDescriptions.push("SRIなし");
    }
    if (params.isCDN) {
      riskDescriptions.push("CDN");
    }
    if (!params.hasCrossorigin) {
      riskDescriptions.push("crossorigin属性なし");
    }

    return createAlert({
      category: "supply_chain",
      severity,
      title: `サプライチェーンリスク: ${params.resourceDomain}`,
      description: `${params.resourceType}が${riskDescriptions.join(", ")}で読み込まれています`,
      domain: params.resourceDomain,
      details: {
        type: "supply_chain",
        pageDomain: params.pageDomain,
        resourceUrl: params.resourceUrl,
        resourceDomain: params.resourceDomain,
        resourceType: params.resourceType,
        hasIntegrity: params.hasIntegrity,
        hasCrossorigin: params.hasCrossorigin,
        isCDN: params.isCDN,
        risks: params.risks,
      },
    });
  }

  /**
   * Create compliance violation alert
   */
  async function alertCompliance(params: {
    pageDomain: string;
    hasPrivacyPolicy: boolean;
    hasTermsOfService: boolean;
    hasCookiePolicy: boolean;
    hasCookieBanner: boolean;
    isCookieBannerGDPRCompliant: boolean;
    hasLoginForm: boolean;
  }): Promise<SecurityAlert | null> {
    const violations: string[] = [];

    // Check for violations
    if (params.hasLoginForm) {
      if (!params.hasPrivacyPolicy) violations.push("missing_privacy_policy");
      if (!params.hasTermsOfService) violations.push("missing_terms_of_service");
    }
    if (!params.hasCookiePolicy) violations.push("missing_cookie_policy");
    if (!params.hasCookieBanner) violations.push("missing_cookie_banner");
    if (params.hasCookieBanner && !params.isCookieBannerGDPRCompliant) {
      violations.push("non_compliant_cookie_banner");
    }

    // Don't create alert if no violations
    if (violations.length === 0) return null;

    // Determine severity based on violations
    const hasLoginViolations =
      params.hasLoginForm &&
      (!params.hasPrivacyPolicy || !params.hasTermsOfService);
    const severity: AlertSeverity = hasLoginViolations ? "high" : "medium";

    const violationDescriptions: string[] = [];
    if (violations.includes("missing_privacy_policy")) {
      violationDescriptions.push("プライバシーポリシーなし");
    }
    if (violations.includes("missing_terms_of_service")) {
      violationDescriptions.push("利用規約なし");
    }
    if (violations.includes("missing_cookie_policy")) {
      violationDescriptions.push("クッキーポリシーなし");
    }
    if (violations.includes("missing_cookie_banner")) {
      violationDescriptions.push("クッキーバナーなし");
    }
    if (violations.includes("non_compliant_cookie_banner")) {
      violationDescriptions.push("GDPR非準拠バナー");
    }

    return createAlert({
      category: "compliance",
      severity,
      title: `コンプライアンス違反: ${params.pageDomain}`,
      description: violationDescriptions.join(", "),
      domain: params.pageDomain,
      details: {
        type: "compliance",
        pageDomain: params.pageDomain,
        hasPrivacyPolicy: params.hasPrivacyPolicy,
        hasTermsOfService: params.hasTermsOfService,
        hasCookiePolicy: params.hasCookiePolicy,
        hasCookieBanner: params.hasCookieBanner,
        isCookieBannerGDPRCompliant: params.isCookieBannerGDPRCompliant,
        hasLoginForm: params.hasLoginForm,
        violations,
      },
    });
  }

  /**
   * Create policy violation alert
   */
  async function alertPolicyViolation(params: {
    domain: string;
    ruleId: string;
    ruleName: string;
    ruleType: "domain" | "tool" | "ai" | "data_transfer";
    action: "allow" | "block" | "warn";
    matchedPattern: string;
    target: string;
  }): Promise<SecurityAlert | null> {
    // Only create alert for block and warn actions
    if (params.action === "allow") return null;

    const severity: AlertSeverity = params.action === "block" ? "high" : "medium";

    const actionLabel = params.action === "block" ? "ブロック" : "警告";
    const ruleTypeLabels: Record<string, string> = {
      domain: "ドメイン",
      tool: "ツール",
      ai: "AI",
      data_transfer: "データ転送",
    };
    const ruleTypeLabel = ruleTypeLabels[params.ruleType] || params.ruleType;

    return createAlert({
      category: "policy_violation",
      severity,
      title: `ポリシー違反${actionLabel}: ${params.ruleName}`,
      description: `${ruleTypeLabel}ルール「${params.ruleName}」に違反: ${params.target}`,
      domain: params.domain,
      details: {
        type: "policy_violation",
        ruleId: params.ruleId,
        ruleName: params.ruleName,
        ruleType: params.ruleType,
        action: params.action,
        matchedPattern: params.matchedPattern,
        target: params.target,
      },
    });
  }

  /**
   * Create tracking beacon alert
   */
  async function alertTrackingBeacon(params: {
    sourceDomain: string;
    targetDomain: string;
    url: string;
    bodySize: number;
    initiator: string;
  }): Promise<SecurityAlert | null> {
    return createAlert({
      category: "tracking_beacon",
      severity: "medium",
      title: `トラッキングビーコン検出: ${params.targetDomain}`,
      description: `${params.sourceDomain}から${params.targetDomain}へビーコン送信`,
      domain: params.targetDomain,
      details: {
        type: "tracking_beacon",
        sourceDomain: params.sourceDomain,
        targetDomain: params.targetDomain,
        url: params.url,
        bodySize: params.bodySize,
        initiator: params.initiator,
      },
    });
  }

  /**
   * Create clipboard hijack alert
   */
  async function alertClipboardHijack(params: {
    domain: string;
    cryptoType: string;
    textPreview: string;
  }): Promise<SecurityAlert | null> {
    return createAlert({
      category: "clipboard_hijack",
      severity: "critical",
      title: `クリップボード乗っ取り検出: ${params.domain}`,
      description: `${params.cryptoType}アドレスがクリップボードに書き込まれました`,
      domain: params.domain,
      details: {
        type: "clipboard_hijack",
        domain: params.domain,
        cryptoType: params.cryptoType,
        textPreview: params.textPreview,
      },
    });
  }

  /**
   * Create cookie access alert
   */
  async function alertCookieAccess(params: {
    domain: string;
    readCount: number;
  }): Promise<SecurityAlert | null> {
    return createAlert({
      category: "cookie_access",
      severity: "medium",
      title: `Cookie盗取の可能性: ${params.domain}`,
      description: `スクリプトがCookieにアクセスしました`,
      domain: params.domain,
      details: {
        type: "cookie_access",
        domain: params.domain,
        readCount: params.readCount,
      },
    });
  }

  /**
   * Create XSS injection alert
   */
  async function alertXSSInjection(params: {
    domain: string;
    injectionType: string;
    payloadPreview: string;
  }): Promise<SecurityAlert | null> {
    return createAlert({
      category: "xss_injection",
      severity: "critical",
      title: `XSS検出: ${params.domain}`,
      description: `${params.injectionType}経由で悪意あるスクリプトを検出`,
      domain: params.domain,
      details: {
        type: "xss_injection",
        domain: params.domain,
        injectionType: params.injectionType,
        payloadPreview: params.payloadPreview,
      },
    });
  }

  /**
   * Create DOM scraping alert
   */
  async function alertDOMScraping(params: {
    domain: string;
    selector: string;
    callCount: number;
  }): Promise<SecurityAlert | null> {
    return createAlert({
      category: "dom_scraping",
      severity: "medium",
      title: `DOMスクレイピング検出: ${params.domain}`,
      description: `短時間に${params.callCount}回のDOM操作を検出`,
      domain: params.domain,
      details: {
        type: "dom_scraping",
        domain: params.domain,
        selector: params.selector,
        callCount: params.callCount,
      },
    });
  }

  /**
   * Create suspicious download alert
   */
  async function alertSuspiciousDownload(params: {
    domain: string;
    downloadType: string;
    filename: string;
    extension: string;
    size: number;
    mimeType: string;
  }): Promise<SecurityAlert | null> {
    // Higher severity for executable files
    const severity: AlertSeverity =
      [".exe", ".msi", ".bat", ".ps1"].includes(params.extension) ? "critical" : "high";

    return createAlert({
      category: "suspicious_download",
      severity,
      title: `疑わしいダウンロード検出: ${params.filename || params.downloadType}`,
      description: `${params.domain}から疑わしいファイルをダウンロード`,
      domain: params.domain,
      details: {
        type: "suspicious_download",
        domain: params.domain,
        downloadType: params.downloadType,
        filename: params.filename,
        extension: params.extension,
        size: params.size,
        mimeType: params.mimeType,
      },
    });
  }

  return {
    createAlert,
    alertNRD,
    alertTyposquat,
    alertAISensitive,
    alertShadowAI,
    alertExtension,
    alertDataExfiltration,
    alertCredentialTheft,
    alertSupplyChainRisk,
    alertCompliance,
    alertPolicyViolation,
    alertTrackingBeacon,
    alertClipboardHijack,
    alertCookieAccess,
    alertXSSInjection,
    alertDOMScraping,
    alertSuspiciousDownload,
    updateAlertStatus,
    getAlerts,
    getAlertCount,
    subscribe,
    acknowledgeAll,
    clearResolved,
  };
}

export type AlertManager = ReturnType<typeof createAlertManager>;
