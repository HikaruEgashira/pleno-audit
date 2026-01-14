/**
 * @fileoverview Compliance Report Generator
 *
 * Generates compliance reports based on collected data
 * and framework requirements.
 */

import type {
  ComplianceFramework,
  ComplianceReport,
  ComplianceControl,
  ComplianceSummary,
  ComplianceStatus,
  ComplianceEvidence,
  ComplianceFinding,
} from "./types.js";

/**
 * Input data for compliance check
 */
export interface ComplianceInput {
  services: Array<{
    domain: string;
    hasLoginPage: boolean;
    privacyPolicyUrl: string | null;
    termsOfServiceUrl: string | null;
    isNRD: boolean;
    isTyposquat: boolean;
    cookieCount: number;
  }>;
  events: Array<{
    type: string;
    domain: string;
    timestamp: number;
    details: Record<string, unknown>;
  }>;
  aiPrompts: Array<{
    domain: string;
    provider: string;
    hasSensitiveData: boolean;
    dataTypes: string[];
  }>;
  cspViolations: Array<{
    domain: string;
    directive: string;
    blockedURL: string;
  }>;
  threats: Array<{
    domain: string;
    severity: string;
    category: string;
  }>;
}

/**
 * Generate unique report ID
 */
function generateReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check access control compliance
 */
function checkAccessControl(input: ComplianceInput): {
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  findings: ComplianceFinding[];
} {
  const evidence: ComplianceEvidence[] = [];
  const findings: ComplianceFinding[] = [];

  // Check for login pages with proper policies
  const loginServices = input.services.filter((s) => s.hasLoginPage);
  const loginWithoutPolicy = loginServices.filter(
    (s) => !s.privacyPolicyUrl || !s.termsOfServiceUrl
  );

  evidence.push({
    type: "scan",
    description: `${loginServices.length}個のログインページを検出`,
    source: "service-detection",
    timestamp: Date.now(),
    data: { count: loginServices.length },
  });

  if (loginWithoutPolicy.length > 0) {
    findings.push({
      severity: "medium",
      description: `${loginWithoutPolicy.length}個のログインページでポリシーが欠落`,
      recommendation: "すべてのログインページにプライバシーポリシーと利用規約を設置してください",
      affectedAssets: loginWithoutPolicy.map((s) => s.domain),
    });
  }

  // Check for NRD/Typosquat risks
  const riskyDomains = input.services.filter((s) => s.isNRD || s.isTyposquat);
  if (riskyDomains.length > 0) {
    findings.push({
      severity: "high",
      description: `${riskyDomains.length}個の疑わしいドメインを検出`,
      recommendation: "NRD/タイポスクワットドメインへのアクセスを制限してください",
      affectedAssets: riskyDomains.map((s) => s.domain),
    });
  }

  const status: ComplianceStatus =
    findings.filter((f) => f.severity === "high" || f.severity === "critical").length > 0
      ? "non_compliant"
      : findings.length > 0
        ? "partial"
        : "compliant";

  return { status, evidence, findings };
}

/**
 * Check data protection compliance
 */
function checkDataProtection(input: ComplianceInput): {
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  findings: ComplianceFinding[];
} {
  const evidence: ComplianceEvidence[] = [];
  const findings: ComplianceFinding[] = [];

  // Check AI prompts for sensitive data
  const sensitivePrompts = input.aiPrompts.filter((p) => p.hasSensitiveData);

  evidence.push({
    type: "log",
    description: `${input.aiPrompts.length}件のAIプロンプトを監視`,
    source: "ai-monitor",
    timestamp: Date.now(),
    data: { total: input.aiPrompts.length, sensitive: sensitivePrompts.length },
  });

  if (sensitivePrompts.length > 0) {
    const credentialLeaks = sensitivePrompts.filter((p) =>
      p.dataTypes.includes("credentials")
    );
    const piiLeaks = sensitivePrompts.filter((p) =>
      p.dataTypes.includes("pii")
    );

    if (credentialLeaks.length > 0) {
      findings.push({
        severity: "critical",
        description: `${credentialLeaks.length}件の認証情報がAIに送信されました`,
        recommendation: "AIプロンプトに認証情報を含めないよう教育を実施してください",
        affectedAssets: [...new Set(credentialLeaks.map((p) => p.domain))],
      });
    }

    if (piiLeaks.length > 0) {
      findings.push({
        severity: "high",
        description: `${piiLeaks.length}件の個人情報がAIに送信されました`,
        recommendation: "AIプロンプトに個人情報を含めないようポリシーを策定してください",
        affectedAssets: [...new Set(piiLeaks.map((p) => p.domain))],
      });
    }
  }

  const status: ComplianceStatus =
    findings.filter((f) => f.severity === "critical").length > 0
      ? "non_compliant"
      : findings.filter((f) => f.severity === "high").length > 0
        ? "partial"
        : "compliant";

  return { status, evidence, findings };
}

/**
 * Check network security compliance
 */
function checkNetworkSecurity(input: ComplianceInput): {
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  findings: ComplianceFinding[];
} {
  const evidence: ComplianceEvidence[] = [];
  const findings: ComplianceFinding[] = [];

  // Check CSP violations
  evidence.push({
    type: "log",
    description: `${input.cspViolations.length}件のCSP違反を記録`,
    source: "csp-monitor",
    timestamp: Date.now(),
    data: { count: input.cspViolations.length },
  });

  if (input.cspViolations.length > 50) {
    findings.push({
      severity: "medium",
      description: `多数のCSP違反（${input.cspViolations.length}件）が検出されました`,
      recommendation: "CSPポリシーを見直し、適切なディレクティブを設定してください",
      affectedAssets: [...new Set(input.cspViolations.map((v) => v.domain))].slice(0, 10),
    });
  }

  // Check threats
  const criticalThreats = input.threats.filter((t) => t.severity === "critical");
  const highThreats = input.threats.filter((t) => t.severity === "high");

  if (criticalThreats.length > 0) {
    findings.push({
      severity: "critical",
      description: `${criticalThreats.length}件の重大な脅威を検出`,
      recommendation: "検出された脅威ドメインへのアクセスをブロックしてください",
      affectedAssets: criticalThreats.map((t) => t.domain),
    });
  }

  if (highThreats.length > 0) {
    findings.push({
      severity: "high",
      description: `${highThreats.length}件の高リスク脅威を検出`,
      recommendation: "脅威ドメインを調査し、必要に応じてブロックしてください",
      affectedAssets: highThreats.map((t) => t.domain),
    });
  }

  const status: ComplianceStatus =
    findings.filter((f) => f.severity === "critical").length > 0
      ? "non_compliant"
      : findings.length > 0
        ? "partial"
        : "compliant";

  return { status, evidence, findings };
}

/**
 * Check privacy compliance
 */
function checkPrivacy(input: ComplianceInput): {
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  findings: ComplianceFinding[];
} {
  const evidence: ComplianceEvidence[] = [];
  const findings: ComplianceFinding[] = [];

  // Check privacy policy coverage
  const servicesWithPolicy = input.services.filter((s) => s.privacyPolicyUrl);
  const coverage = input.services.length > 0
    ? (servicesWithPolicy.length / input.services.length) * 100
    : 100;

  evidence.push({
    type: "scan",
    description: `プライバシーポリシー検出率: ${coverage.toFixed(1)}%`,
    source: "policy-detection",
    timestamp: Date.now(),
    data: {
      total: input.services.length,
      withPolicy: servicesWithPolicy.length,
      coverage,
    },
  });

  if (coverage < 80) {
    findings.push({
      severity: "medium",
      description: `${100 - coverage.toFixed(0)}%のサービスでプライバシーポリシーが見つかりません`,
      recommendation: "すべてのサービスでプライバシーポリシーを確認してください",
      affectedAssets: input.services
        .filter((s) => !s.privacyPolicyUrl)
        .map((s) => s.domain)
        .slice(0, 10),
    });
  }

  // Check cookie usage
  const highCookieServices = input.services.filter((s) => s.cookieCount > 10);
  if (highCookieServices.length > 0) {
    evidence.push({
      type: "scan",
      description: `${highCookieServices.length}個のサービスで10個以上のCookieを使用`,
      source: "cookie-detection",
      timestamp: Date.now(),
    });
  }

  const status: ComplianceStatus =
    coverage >= 90 && findings.length === 0
      ? "compliant"
      : coverage >= 70
        ? "partial"
        : "non_compliant";

  return { status, evidence, findings };
}

/**
 * Check monitoring compliance
 */
function checkMonitoring(input: ComplianceInput): {
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  findings: ComplianceFinding[];
} {
  const evidence: ComplianceEvidence[] = [];
  const findings: ComplianceFinding[] = [];

  // Check event logging
  evidence.push({
    type: "log",
    description: `${input.events.length}件のイベントを記録`,
    source: "event-store",
    timestamp: Date.now(),
    data: { count: input.events.length },
  });

  // Check monitoring coverage
  const eventTypes = new Set(input.events.map((e) => e.type));
  const expectedTypes = [
    "login_detected",
    "csp_violation",
    "network_request",
    "ai_prompt_sent",
  ];
  const coverage = expectedTypes.filter((t) => eventTypes.has(t)).length;

  evidence.push({
    type: "config",
    description: `${coverage}/${expectedTypes.length}種類のイベントを監視中`,
    source: "monitoring-config",
    timestamp: Date.now(),
    data: { monitored: coverage, total: expectedTypes.length },
  });

  const status: ComplianceStatus =
    coverage >= 3 ? "compliant" : coverage >= 2 ? "partial" : "non_compliant";

  return { status, evidence, findings };
}

/**
 * Generate compliance report for a framework
 */
export function generateComplianceReport(
  framework: ComplianceFramework,
  input: ComplianceInput,
  period: { start: number; end: number }
): ComplianceReport {
  const startTime = Date.now();
  const controls: ComplianceControl[] = [];

  // Access Control
  const accessCheck = checkAccessControl(input);
  controls.push({
    id: framework === "soc2" ? "CC6.1" : "access-control",
    framework,
    category: "access_control",
    name: "アクセス制御",
    description: "論理的アクセスセキュリティの実装",
    requirement: "適切なアクセス制御メカニズムの実装",
    status: accessCheck.status,
    evidence: accessCheck.evidence,
    findings: accessCheck.findings,
    lastChecked: Date.now(),
  });

  // Data Protection
  const dataCheck = checkDataProtection(input);
  controls.push({
    id: framework === "gdpr" ? "Art.25" : "data-protection",
    framework,
    category: "data_protection",
    name: "データ保護",
    description: "個人データおよび機密データの保護",
    requirement: "適切な技術的・組織的措置の実施",
    status: dataCheck.status,
    evidence: dataCheck.evidence,
    findings: dataCheck.findings,
    lastChecked: Date.now(),
  });

  // Network Security
  const networkCheck = checkNetworkSecurity(input);
  controls.push({
    id: framework === "soc2" ? "CC6.6" : "network-security",
    framework,
    category: "network_security",
    name: "ネットワークセキュリティ",
    description: "不正アクセスおよびマルウェアからの保護",
    requirement: "ネットワークセキュリティ対策の実施",
    status: networkCheck.status,
    evidence: networkCheck.evidence,
    findings: networkCheck.findings,
    lastChecked: Date.now(),
  });

  // Privacy
  const privacyCheck = checkPrivacy(input);
  controls.push({
    id: framework === "gdpr" ? "Art.5" : "privacy",
    framework,
    category: "privacy",
    name: "プライバシー",
    description: "プライバシーポリシーと透明性",
    requirement: "データ処理の透明性確保",
    status: privacyCheck.status,
    evidence: privacyCheck.evidence,
    findings: privacyCheck.findings,
    lastChecked: Date.now(),
  });

  // Monitoring
  const monitoringCheck = checkMonitoring(input);
  controls.push({
    id: framework === "soc2" ? "CC7.2" : "monitoring",
    framework,
    category: "monitoring",
    name: "監視・ログ管理",
    description: "セキュリティイベントの監視とログ記録",
    requirement: "継続的な監視体制の構築",
    status: monitoringCheck.status,
    evidence: monitoringCheck.evidence,
    findings: monitoringCheck.findings,
    lastChecked: Date.now(),
  });

  // Calculate summary
  const summary = calculateSummary(controls);

  // Generate recommendations
  const recommendations = generateRecommendations(controls);

  return {
    id: generateReportId(),
    framework,
    generatedAt: Date.now(),
    period,
    summary,
    controls,
    recommendations,
    metadata: {
      totalDomains: input.services.length,
      totalEvents: input.events.length,
      scanDuration: Date.now() - startTime,
    },
  };
}

/**
 * Calculate compliance summary
 */
function calculateSummary(controls: ComplianceControl[]): ComplianceSummary {
  const totalControls = controls.length;
  const compliantControls = controls.filter((c) => c.status === "compliant").length;
  const partialControls = controls.filter((c) => c.status === "partial").length;
  const nonCompliantControls = controls.filter((c) => c.status === "non_compliant").length;
  const notApplicableControls = controls.filter((c) => c.status === "not_applicable").length;

  const allFindings = controls.flatMap((c) => c.findings);
  const criticalFindings = allFindings.filter((f) => f.severity === "critical").length;
  const highFindings = allFindings.filter((f) => f.severity === "high").length;
  const mediumFindings = allFindings.filter((f) => f.severity === "medium").length;
  const lowFindings = allFindings.filter((f) => f.severity === "low").length;

  // Calculate score
  const applicableControls = totalControls - notApplicableControls;
  const score = applicableControls > 0
    ? Math.round(
        ((compliantControls + partialControls * 0.5) / applicableControls) * 100
      )
    : 100;

  // Determine overall status
  let overallStatus: ComplianceStatus;
  if (criticalFindings > 0 || nonCompliantControls > applicableControls * 0.3) {
    overallStatus = "non_compliant";
  } else if (highFindings > 0 || partialControls > applicableControls * 0.5) {
    overallStatus = "partial";
  } else {
    overallStatus = "compliant";
  }

  return {
    overallStatus,
    score,
    totalControls,
    compliantControls,
    partialControls,
    nonCompliantControls,
    notApplicableControls,
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings,
  };
}

/**
 * Generate recommendations based on findings
 */
function generateRecommendations(controls: ComplianceControl[]): string[] {
  const recommendations: string[] = [];
  const allFindings = controls.flatMap((c) => c.findings);

  // Prioritize by severity
  const critical = allFindings.filter((f) => f.severity === "critical");
  const high = allFindings.filter((f) => f.severity === "high");

  for (const finding of critical) {
    recommendations.push(`[緊急] ${finding.recommendation}`);
  }

  for (const finding of high) {
    recommendations.push(`[重要] ${finding.recommendation}`);
  }

  // Add general recommendations
  const nonCompliant = controls.filter((c) => c.status === "non_compliant");
  if (nonCompliant.length > 0) {
    recommendations.push(
      `${nonCompliant.length}件のコントロールが非準拠です。優先的に対応してください。`
    );
  }

  return [...new Set(recommendations)].slice(0, 10);
}

/**
 * Export report as JSON
 */
export function exportReportJSON(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report as Markdown
 */
export function exportReportMarkdown(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push(`# コンプライアンスレポート - ${report.framework.toUpperCase()}`);
  lines.push("");
  lines.push(`生成日時: ${new Date(report.generatedAt).toLocaleString("ja-JP")}`);
  lines.push(`期間: ${new Date(report.period.start).toLocaleDateString("ja-JP")} - ${new Date(report.period.end).toLocaleDateString("ja-JP")}`);
  lines.push("");

  // Summary
  lines.push("## サマリー");
  lines.push("");
  lines.push(`| 項目 | 値 |`);
  lines.push(`|------|------|`);
  lines.push(`| 総合ステータス | ${report.summary.overallStatus} |`);
  lines.push(`| スコア | ${report.summary.score}/100 |`);
  lines.push(`| 準拠コントロール | ${report.summary.compliantControls}/${report.summary.totalControls} |`);
  lines.push(`| 重大な発見事項 | ${report.summary.criticalFindings} |`);
  lines.push(`| 高リスク発見事項 | ${report.summary.highFindings} |`);
  lines.push("");

  // Controls
  lines.push("## コントロール詳細");
  lines.push("");

  for (const control of report.controls) {
    lines.push(`### ${control.name} (${control.id})`);
    lines.push("");
    lines.push(`**ステータス**: ${control.status}`);
    lines.push("");
    lines.push(`**説明**: ${control.description}`);
    lines.push("");

    if (control.findings.length > 0) {
      lines.push("**発見事項**:");
      for (const finding of control.findings) {
        lines.push(`- [${finding.severity}] ${finding.description}`);
      }
      lines.push("");
    }

    if (control.evidence.length > 0) {
      lines.push("**エビデンス**:");
      for (const ev of control.evidence) {
        lines.push(`- ${ev.description}`);
      }
      lines.push("");
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push("## 推奨事項");
    lines.push("");
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join("\n");
}
