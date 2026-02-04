/**
 * @fileoverview Alert Builders
 *
 * Pure builders for alert payload creation logic.
 */

import type {
  AlertAction,
  AlertDetails,
  AlertSeverity,
  AlertCategory,
} from "./types.js";

export interface CreateAlertInput {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  domain: string;
  details: AlertDetails;
  actions?: AlertAction[];
}

export interface NRDAlertParams {
  domain: string;
  domainAge: number | null;
  registrationDate: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
}

export function buildNRDAlert(params: NRDAlertParams): CreateAlertInput {
  const severity: AlertSeverity =
    params.confidence === "high" ? "high" : "medium";

  return {
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
  };
}

export interface TyposquatAlertParams {
  domain: string;
  targetDomain?: string;
  homoglyphCount: number;
  confidence: "high" | "medium" | "low" | "none";
}

export function buildTyposquatAlert(
  params: TyposquatAlertParams
): CreateAlertInput | null {
  if (params.confidence === "none") {
    return null;
  }

  const severity: AlertSeverity =
    params.confidence === "high" ? "critical" : "high";

  return {
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
  };
}

export interface AISensitiveAlertParams {
  domain: string;
  provider: string;
  model?: string;
  dataTypes: string[];
}

export function buildAISensitiveAlert(
  params: AISensitiveAlertParams
): CreateAlertInput {
  const hasCredentials = params.dataTypes.includes("credentials");
  const severity: AlertSeverity = hasCredentials ? "critical" : "high";

  return {
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
  };
}

export interface ShadowAIAlertParams {
  domain: string;
  provider: string;
  providerDisplayName: string;
  category: "major" | "enterprise" | "open_source" | "regional" | "specialized";
  riskLevel: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  model?: string;
}

export function buildShadowAIAlert(params: ShadowAIAlertParams): CreateAlertInput {
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

  return {
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
  };
}

export interface ExtensionAlertParams {
  extensionId: string;
  extensionName: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskScore: number;
  flags: string[];
  requestCount: number;
  targetDomains: string[];
}

export function buildExtensionAlert(params: ExtensionAlertParams): CreateAlertInput {
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

  return {
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
  };
}

export interface DataExfiltrationAlertParams {
  sourceDomain: string;
  targetDomain: string;
  bodySize: number;
  method: string;
  initiator: string;
}

export function buildDataExfiltrationAlert(
  params: DataExfiltrationAlertParams
): CreateAlertInput {
  const sizeKB = Math.round(params.bodySize / 1024);
  const severity: AlertSeverity = sizeKB > 500 ? "critical" : "high";

  return {
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
  };
}

export interface CredentialTheftAlertParams {
  sourceDomain: string;
  targetDomain: string;
  formAction: string;
  isSecure: boolean;
  isCrossOrigin: boolean;
  fieldType: string;
  risks: string[];
}

export function buildCredentialTheftAlert(
  params: CredentialTheftAlertParams
): CreateAlertInput {
  const hasInsecureProtocol = params.risks.includes("insecure_protocol");
  const severity: AlertSeverity = hasInsecureProtocol ? "critical" : "high";

  const riskDescriptions: string[] = [];
  if (hasInsecureProtocol) {
    riskDescriptions.push("非HTTPS通信");
  }
  if (params.isCrossOrigin) {
    riskDescriptions.push("クロスオリジン送信");
  }

  return {
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
  };
}

export interface SupplyChainRiskAlertParams {
  pageDomain: string;
  resourceUrl: string;
  resourceDomain: string;
  resourceType: string;
  hasIntegrity: boolean;
  hasCrossorigin: boolean;
  isCDN: boolean;
  risks: string[];
}

export function buildSupplyChainRiskAlert(
  params: SupplyChainRiskAlertParams
): CreateAlertInput {
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

  return {
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
  };
}

export interface ComplianceAlertParams {
  pageDomain: string;
  hasPrivacyPolicy: boolean;
  hasTermsOfService: boolean;
  hasCookiePolicy: boolean;
  hasCookieBanner: boolean;
  isCookieBannerGDPRCompliant: boolean;
  hasLoginForm: boolean;
}

export function buildComplianceAlert(
  params: ComplianceAlertParams
): CreateAlertInput | null {
  const violations: string[] = [];

  if (params.hasLoginForm) {
    if (!params.hasPrivacyPolicy) {
      violations.push("missing_privacy_policy");
    }
    if (!params.hasTermsOfService) {
      violations.push("missing_terms_of_service");
    }
  }

  if (!params.hasCookiePolicy) {
    violations.push("missing_cookie_policy");
  }

  if (!params.hasCookieBanner) {
    violations.push("missing_cookie_banner");
  }

  if (params.hasCookieBanner && !params.isCookieBannerGDPRCompliant) {
    violations.push("non_compliant_cookie_banner");
  }

  if (violations.length === 0) {
    return null;
  }

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

  return {
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
  };
}

export interface PolicyViolationAlertParams {
  domain: string;
  ruleId: string;
  ruleName: string;
  ruleType: "domain" | "tool" | "ai" | "data_transfer";
  action: "allow" | "block" | "warn";
  matchedPattern: string;
  target: string;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  domain: "ドメイン",
  tool: "ツール",
  ai: "AI",
  data_transfer: "データ転送",
};

export function buildPolicyViolationAlert(
  params: PolicyViolationAlertParams
): CreateAlertInput | null {
  if (params.action === "allow") {
    return null;
  }

  const severity: AlertSeverity = params.action === "block" ? "high" : "medium";
  const actionLabel = params.action === "block" ? "ブロック" : "警告";
  const ruleTypeLabel = RULE_TYPE_LABELS[params.ruleType] || params.ruleType;

  return {
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
  };
}

export interface TrackingBeaconAlertParams {
  sourceDomain: string;
  targetDomain: string;
  url: string;
  bodySize: number;
  initiator: string;
}

export function buildTrackingBeaconAlert(
  params: TrackingBeaconAlertParams
): CreateAlertInput {
  return {
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
  };
}

export interface ClipboardHijackAlertParams {
  domain: string;
  cryptoType: string;
  textPreview: string;
}

export function buildClipboardHijackAlert(
  params: ClipboardHijackAlertParams
): CreateAlertInput {
  return {
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
  };
}

export interface CookieAccessAlertParams {
  domain: string;
  readCount: number;
}

export function buildCookieAccessAlert(
  params: CookieAccessAlertParams
): CreateAlertInput {
  return {
    category: "cookie_access",
    severity: "medium",
    title: `Cookie盗取の可能性: ${params.domain}`,
    description: "スクリプトがCookieにアクセスしました",
    domain: params.domain,
    details: {
      type: "cookie_access",
      domain: params.domain,
      readCount: params.readCount,
    },
  };
}

export interface XSSInjectionAlertParams {
  domain: string;
  injectionType: string;
  payloadPreview: string;
}

export function buildXSSInjectionAlert(
  params: XSSInjectionAlertParams
): CreateAlertInput {
  return {
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
  };
}

export interface DOMScrapingAlertParams {
  domain: string;
  selector: string;
  callCount: number;
}

export function buildDOMScrapingAlert(
  params: DOMScrapingAlertParams
): CreateAlertInput {
  return {
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
  };
}

export interface SuspiciousDownloadAlertParams {
  domain: string;
  downloadType: string;
  filename: string;
  extension: string;
  size: number;
  mimeType: string;
}

export function buildSuspiciousDownloadAlert(
  params: SuspiciousDownloadAlertParams
): CreateAlertInput {
  const severity: AlertSeverity =
    [".exe", ".msi", ".bat", ".ps1"].includes(params.extension) ? "critical" : "high";

  return {
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
  };
}
