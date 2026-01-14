/**
 * @fileoverview Risk Prioritizer
 *
 * Context-aware risk scoring and prioritization.
 * Wiz-style focus on exploitable paths and business impact.
 */

import type {
  RiskSeverity,
  RiskCategory,
  RiskFactor,
  PrioritizedRisk,
  RiskImpact,
  RemediationAction,
  RiskSummary,
} from "./types.js";
import { SEVERITY_THRESHOLDS } from "./types.js";

export interface RiskInput {
  domain: string;
  isNRD?: boolean;
  nrdConfidence?: string;
  isTyposquat?: boolean;
  typosquatTarget?: string;
  hasLogin?: boolean;
  hasPrivacyPolicy?: boolean;
  cookieCount?: number;
  sessionCookies?: number;
  aiPromptsCount?: number;
  sensitiveDataTypes?: string[];
  extensionRequests?: number;
  policyViolations?: number;
}

export interface RiskPrioritizer {
  analyzeRisk(input: RiskInput): PrioritizedRisk;
  prioritizeAll(inputs: RiskInput[]): PrioritizedRisk[];
  getSummary(risks: PrioritizedRisk[]): RiskSummary;
  getTopRisks(risks: PrioritizedRisk[], limit?: number): PrioritizedRisk[];
}

/**
 * Create risk prioritizer
 */
export function createRiskPrioritizer(): RiskPrioritizer {
  function generateId(): string {
    return `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate risk score from factors
   */
  function calculateScore(factors: RiskFactor[]): number {
    let score = 0;
    for (const factor of factors) {
      if (factor.present) {
        score += factor.weight;
      }
    }
    return Math.min(100, score);
  }

  /**
   * Determine severity from score
   */
  function scoreToSeverity(score: number): RiskSeverity {
    if (score >= SEVERITY_THRESHOLDS.critical) return "critical";
    if (score >= SEVERITY_THRESHOLDS.high) return "high";
    if (score >= SEVERITY_THRESHOLDS.medium) return "medium";
    if (score >= SEVERITY_THRESHOLDS.low) return "low";
    return "info";
  }

  /**
   * Generate risk factors from input
   */
  function generateFactors(input: RiskInput): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // NRD Risk
    if (input.isNRD) {
      factors.push({
        id: "nrd",
        name: "新規登録ドメイン (NRD)",
        category: "suspicious_domain",
        weight: input.nrdConfidence === "high" ? 30 : 20,
        present: true,
        description: "最近登録されたドメインはフィッシングのリスクが高い",
        evidence: [`${input.domain}は新規登録ドメイン`],
      });
    }

    // Typosquat Risk
    if (input.isTyposquat) {
      factors.push({
        id: "typosquat",
        name: "タイポスクワット検出",
        category: "malicious_site",
        weight: 35,
        present: true,
        description: "正規サイトに類似した悪意のあるドメイン",
        evidence: [
          `${input.domain}は${input.typosquatTarget || "有名サイト"}に類似`,
        ],
      });
    }

    // Login without privacy policy
    if (input.hasLogin && !input.hasPrivacyPolicy) {
      factors.push({
        id: "login_no_privacy",
        name: "ログインページ（プライバシーポリシーなし）",
        category: "credential_theft",
        weight: 25,
        present: true,
        description: "認証情報を収集するがプライバシーポリシーがない",
        evidence: ["ログインフォームを検出", "プライバシーポリシーが見つからない"],
      });
    }

    // Session cookies on suspicious domain
    if ((input.isNRD || input.isTyposquat) && (input.sessionCookies || 0) > 0) {
      factors.push({
        id: "session_suspicious",
        name: "セッションCookieのリスク",
        category: "credential_theft",
        weight: 30,
        present: true,
        description: "不審なドメインでセッションCookieが設定されている",
        evidence: [`${input.sessionCookies}個のセッションCookie`],
      });
    }

    // AI Data Leak Risk
    if ((input.aiPromptsCount || 0) > 0) {
      const weight =
        (input.sensitiveDataTypes?.length || 0) > 0
          ? 30
          : input.aiPromptsCount! > 10
            ? 15
            : 5;
      factors.push({
        id: "ai_data",
        name: "AIサービスへのデータ送信",
        category: "ai_data_leak",
        weight,
        present: true,
        description: "AIサービスにデータが送信されている",
        evidence: [
          `${input.aiPromptsCount}件のプロンプト送信`,
          ...(input.sensitiveDataTypes || []).map((t) => `機密データタイプ: ${t}`),
        ],
      });
    }

    // Policy Violations
    if ((input.policyViolations || 0) > 0) {
      factors.push({
        id: "policy_violation",
        name: "ポリシー違反",
        category: "policy_violation",
        weight: Math.min(25, input.policyViolations! * 5),
        present: true,
        description: "セキュリティポリシーに違反している",
        evidence: [`${input.policyViolations}件の違反`],
      });
    }

    // Extension Risk
    if ((input.extensionRequests || 0) > 50) {
      factors.push({
        id: "extension_activity",
        name: "拡張機能の過剰なアクティビティ",
        category: "extension_risk",
        weight: 15,
        present: true,
        description: "拡張機能からの異常な数のリクエスト",
        evidence: [`${input.extensionRequests}件のリクエスト`],
      });
    }

    return factors;
  }

  /**
   * Determine primary risk category
   */
  function getPrimaryCategory(factors: RiskFactor[]): RiskCategory {
    const presentFactors = factors.filter((f) => f.present);
    if (presentFactors.length === 0) return "unmonitored_service";

    // Sort by weight and return highest
    presentFactors.sort((a, b) => b.weight - a.weight);
    return presentFactors[0].category;
  }

  /**
   * Generate impact assessment
   */
  function assessImpact(input: RiskInput, score: number): RiskImpact {
    const dataAtRisk: string[] = [];

    if (input.hasLogin) dataAtRisk.push("認証情報");
    if (input.sensitiveDataTypes?.includes("pii")) dataAtRisk.push("個人情報");
    if (input.sensitiveDataTypes?.includes("credentials")) dataAtRisk.push("APIキー");
    if (input.sensitiveDataTypes?.includes("financial")) dataAtRisk.push("金融情報");
    if ((input.sessionCookies || 0) > 0) dataAtRisk.push("セッションデータ");

    const exploitability =
      input.isTyposquat
        ? "easy"
        : input.isNRD
          ? "moderate"
          : "difficult";

    const businessImpact =
      score >= 80
        ? "critical"
        : score >= 60
          ? "high"
          : score >= 40
            ? "medium"
            : "low";

    return {
      dataAtRisk,
      affectedUsers: input.hasLogin ? "all" : "specific",
      businessImpact,
      exploitability,
    };
  }

  /**
   * Generate remediation actions
   */
  function generateRemediation(
    input: RiskInput,
    severity: RiskSeverity
  ): RemediationAction[] {
    const actions: RemediationAction[] = [];

    if (input.isTyposquat) {
      actions.push({
        id: "block_1",
        type: "block_access",
        priority: "immediate",
        description: `${input.domain}へのアクセスをブロック`,
        automated: true,
        status: "pending",
      });
    }

    if (input.isNRD && input.hasLogin) {
      actions.push({
        id: "investigate_1",
        type: "investigate",
        priority: "immediate",
        description: "ログインページの正当性を確認",
        automated: false,
        status: "pending",
      });
    }

    if ((input.aiPromptsCount || 0) > 0 && input.sensitiveDataTypes?.length) {
      actions.push({
        id: "policy_1",
        type: "update_policy",
        priority: "short_term",
        description: "AIサービスへの機密データ送信を制限するポリシーを追加",
        automated: false,
        status: "pending",
      });
    }

    if (severity === "critical" || severity === "high") {
      actions.push({
        id: "monitor_1",
        type: "enable_monitoring",
        priority: "immediate",
        description: "強化監視を有効化",
        automated: true,
        status: "pending",
      });
    }

    if (actions.length === 0) {
      actions.push({
        id: "accept_1",
        type: "accept_risk",
        priority: "long_term",
        description: "リスクを認識し監視を継続",
        automated: false,
        status: "pending",
      });
    }

    return actions;
  }

  /**
   * Analyze single risk
   */
  function analyzeRisk(input: RiskInput): PrioritizedRisk {
    const factors = generateFactors(input);
    const score = calculateScore(factors);
    const severity = scoreToSeverity(score);
    const category = getPrimaryCategory(factors);
    const impact = assessImpact(input, score);
    const remediation = generateRemediation(input, severity);

    // Generate title based on primary risk
    let title = `${input.domain}のセキュリティリスク`;
    if (input.isTyposquat) {
      title = `タイポスクワット: ${input.domain}`;
    } else if (input.isNRD) {
      title = `NRDサイト: ${input.domain}`;
    }

    // Generate description
    const descriptions: string[] = [];
    if (input.isTyposquat) descriptions.push("正規サイトに類似したドメイン");
    if (input.isNRD) descriptions.push("新規登録ドメイン");
    if (input.hasLogin && !input.hasPrivacyPolicy)
      descriptions.push("プライバシーポリシーなしのログインページ");

    return {
      id: generateId(),
      title,
      description: descriptions.join("。") || "潜在的なセキュリティリスク",
      severity,
      score,
      category,
      domain: input.domain,
      factors,
      impact,
      remediation,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      status: "open",
    };
  }

  /**
   * Prioritize all risks
   */
  function prioritizeAll(inputs: RiskInput[]): PrioritizedRisk[] {
    const risks = inputs.map(analyzeRisk);

    // Sort by score (descending), then by exploitability
    risks.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const exploitOrder = { trivial: 0, easy: 1, moderate: 2, difficult: 3 };
      return (
        exploitOrder[a.impact.exploitability] -
        exploitOrder[b.impact.exploitability]
      );
    });

    return risks;
  }

  /**
   * Get risk summary
   */
  function getSummary(risks: PrioritizedRisk[]): RiskSummary {
    const criticalCount = risks.filter((r) => r.severity === "critical").length;
    const highCount = risks.filter((r) => r.severity === "high").length;
    const mediumCount = risks.filter((r) => r.severity === "medium").length;
    const lowCount = risks.filter((r) => r.severity === "low").length;

    // Count by category
    const categoryMap = new Map<RiskCategory, number>();
    for (const risk of risks) {
      categoryMap.set(risk.category, (categoryMap.get(risk.category) || 0) + 1);
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const averageScore =
      risks.length > 0
        ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length
        : 0;

    const completedRemediations = risks.reduce(
      (sum, r) =>
        sum + r.remediation.filter((a) => a.status === "completed").length,
      0
    );
    const totalRemediations = risks.reduce(
      (sum, r) => sum + r.remediation.length,
      0
    );
    const remediationProgress =
      totalRemediations > 0
        ? Math.round((completedRemediations / totalRemediations) * 100)
        : 100;

    return {
      totalRisks: risks.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      topCategories,
      riskTrend: {
        direction: criticalCount > 0 ? "increasing" : "stable",
        changePercent: 0,
        comparisonPeriod: "week",
      },
      averageScore: Math.round(averageScore),
      remediationProgress,
    };
  }

  /**
   * Get top risks
   */
  function getTopRisks(
    risks: PrioritizedRisk[],
    limit = 10
  ): PrioritizedRisk[] {
    return risks.slice(0, limit);
  }

  return {
    analyzeRisk,
    prioritizeAll,
    getSummary,
    getTopRisks,
  };
}
