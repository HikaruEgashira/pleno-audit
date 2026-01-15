/**
 * @fileoverview Risk Benchmark Module
 *
 * Compares organization risk metrics against industry benchmarks
 * and provides recommendations based on performance gaps.
 */

export type Industry =
  | "technology"
  | "finance"
  | "healthcare"
  | "retail"
  | "manufacturing"
  | "media"
  | "education"
  | "government"
  | "other";

export type CompanySize = "startup" | "small" | "medium" | "large" | "enterprise";

export interface RiskBenchmark {
  industry: Industry;
  size: CompanySize;
  avgRiskScore: number;
  avgAnomalyDetectionRate: number;
  avgDataBreachRisk: number;
  avgSecurityEventFrequency: number;
  avgComplianceScore: number;
  avgCSPViolationRate: number;
  avgAISecurityScore: number;
  avgAuthenticationScore: number;
  avgNetworkSecurityScore: number;
}

export interface OrganizationMetrics {
  riskScore: number;
  anomalyDetectionRate: number;
  dataBreachRisk: number;
  securityEventFrequency: number;
  complianceScore: number;
  cspViolationRate: number;
  aiSecurityScore: number;
  authenticationScore: number;
  networkSecurityScore: number;
}

export interface BenchmarkComparison {
  industry: Industry;
  size: CompanySize;
  benchmarks: RiskBenchmark;
  metrics: OrganizationMetrics;
  performanceGaps: PerformanceGap[];
  overallRanking: BenchmarkRank;
  recommendations: string[];
}

export interface PerformanceGap {
  metric: string;
  organizationScore: number;
  benchmarkScore: number;
  gap: number;
  percentile: number;
  recommendation: string;
}

export type BenchmarkRank =
  | "top_performer"
  | "above_average"
  | "average"
  | "below_average"
  | "at_risk";

// Industry Benchmarks (based on security research and industry reports)
const INDUSTRY_BENCHMARKS: Record<Industry, Record<CompanySize, RiskBenchmark>> =
  {
    technology: {
      startup: {
        industry: "technology",
        size: "startup",
        avgRiskScore: 55,
        avgAnomalyDetectionRate: 65,
        avgDataBreachRisk: 12,
        avgSecurityEventFrequency: 180,
        avgComplianceScore: 68,
        avgCSPViolationRate: 35,
        avgAISecurityScore: 60,
        avgAuthenticationScore: 75,
        avgNetworkSecurityScore: 70,
      },
      small: {
        industry: "technology",
        size: "small",
        avgRiskScore: 48,
        avgAnomalyDetectionRate: 72,
        avgDataBreachRisk: 8,
        avgSecurityEventFrequency: 150,
        avgComplianceScore: 75,
        avgCSPViolationRate: 25,
        avgAISecurityScore: 68,
        avgAuthenticationScore: 82,
        avgNetworkSecurityScore: 78,
      },
      medium: {
        industry: "technology",
        size: "medium",
        avgRiskScore: 42,
        avgAnomalyDetectionRate: 78,
        avgDataBreachRisk: 5,
        avgSecurityEventFrequency: 120,
        avgComplianceScore: 82,
        avgCSPViolationRate: 18,
        avgAISecurityScore: 75,
        avgAuthenticationScore: 88,
        avgNetworkSecurityScore: 85,
      },
      large: {
        industry: "technology",
        size: "large",
        avgRiskScore: 38,
        avgAnomalyDetectionRate: 85,
        avgDataBreachRisk: 3,
        avgSecurityEventFrequency: 100,
        avgComplianceScore: 88,
        avgCSPViolationRate: 12,
        avgAISecurityScore: 82,
        avgAuthenticationScore: 92,
        avgNetworkSecurityScore: 90,
      },
      enterprise: {
        industry: "technology",
        size: "enterprise",
        avgRiskScore: 35,
        avgAnomalyDetectionRate: 90,
        avgDataBreachRisk: 1,
        avgSecurityEventFrequency: 80,
        avgComplianceScore: 92,
        avgCSPViolationRate: 8,
        avgAISecurityScore: 88,
        avgAuthenticationScore: 95,
        avgNetworkSecurityScore: 94,
      },
    },
    finance: {
      startup: {
        industry: "finance",
        size: "startup",
        avgRiskScore: 65,
        avgAnomalyDetectionRate: 70,
        avgDataBreachRisk: 15,
        avgSecurityEventFrequency: 200,
        avgComplianceScore: 75,
        avgCSPViolationRate: 40,
        avgAISecurityScore: 55,
        avgAuthenticationScore: 85,
        avgNetworkSecurityScore: 75,
      },
      small: {
        industry: "finance",
        size: "small",
        avgRiskScore: 55,
        avgAnomalyDetectionRate: 75,
        avgDataBreachRisk: 10,
        avgSecurityEventFrequency: 170,
        avgComplianceScore: 82,
        avgCSPViolationRate: 30,
        avgAISecurityScore: 65,
        avgAuthenticationScore: 90,
        avgNetworkSecurityScore: 82,
      },
      medium: {
        industry: "finance",
        size: "medium",
        avgRiskScore: 48,
        avgAnomalyDetectionRate: 82,
        avgDataBreachRisk: 6,
        avgSecurityEventFrequency: 140,
        avgComplianceScore: 88,
        avgCSPViolationRate: 22,
        avgAISecurityScore: 72,
        avgAuthenticationScore: 94,
        avgNetworkSecurityScore: 88,
      },
      large: {
        industry: "finance",
        size: "large",
        avgRiskScore: 42,
        avgAnomalyDetectionRate: 88,
        avgDataBreachRisk: 4,
        avgSecurityEventFrequency: 110,
        avgComplianceScore: 93,
        avgCSPViolationRate: 15,
        avgAISecurityScore: 80,
        avgAuthenticationScore: 96,
        avgNetworkSecurityScore: 92,
      },
      enterprise: {
        industry: "finance",
        size: "enterprise",
        avgRiskScore: 38,
        avgAnomalyDetectionRate: 93,
        avgDataBreachRisk: 1,
        avgSecurityEventFrequency: 85,
        avgComplianceScore: 96,
        avgCSPViolationRate: 8,
        avgAISecurityScore: 87,
        avgAuthenticationScore: 98,
        avgNetworkSecurityScore: 96,
      },
    },
    healthcare: {
      startup: {
        industry: "healthcare",
        size: "startup",
        avgRiskScore: 72,
        avgAnomalyDetectionRate: 60,
        avgDataBreachRisk: 18,
        avgSecurityEventFrequency: 220,
        avgComplianceScore: 70,
        avgCSPViolationRate: 45,
        avgAISecurityScore: 50,
        avgAuthenticationScore: 80,
        avgNetworkSecurityScore: 72,
      },
      small: {
        industry: "healthcare",
        size: "small",
        avgRiskScore: 62,
        avgAnomalyDetectionRate: 68,
        avgDataBreachRisk: 12,
        avgSecurityEventFrequency: 190,
        avgComplianceScore: 78,
        avgCSPViolationRate: 35,
        avgAISecurityScore: 60,
        avgAuthenticationScore: 85,
        avgNetworkSecurityScore: 78,
      },
      medium: {
        industry: "healthcare",
        size: "medium",
        avgRiskScore: 52,
        avgAnomalyDetectionRate: 76,
        avgDataBreachRisk: 8,
        avgSecurityEventFrequency: 160,
        avgComplianceScore: 85,
        avgCSPViolationRate: 25,
        avgAISecurityScore: 70,
        avgAuthenticationScore: 90,
        avgNetworkSecurityScore: 85,
      },
      large: {
        industry: "healthcare",
        size: "large",
        avgRiskScore: 45,
        avgAnomalyDetectionRate: 84,
        avgDataBreachRisk: 5,
        avgSecurityEventFrequency: 130,
        avgComplianceScore: 90,
        avgCSPViolationRate: 18,
        avgAISecurityScore: 78,
        avgAuthenticationScore: 93,
        avgNetworkSecurityScore: 90,
      },
      enterprise: {
        industry: "healthcare",
        size: "enterprise",
        avgRiskScore: 40,
        avgAnomalyDetectionRate: 91,
        avgDataBreachRisk: 2,
        avgSecurityEventFrequency: 100,
        avgComplianceScore: 94,
        avgCSPViolationRate: 10,
        avgAISecurityScore: 85,
        avgAuthenticationScore: 96,
        avgNetworkSecurityScore: 94,
      },
    },
    retail: {
      startup: {
        industry: "retail",
        size: "startup",
        avgRiskScore: 60,
        avgAnomalyDetectionRate: 55,
        avgDataBreachRisk: 14,
        avgSecurityEventFrequency: 170,
        avgComplianceScore: 65,
        avgCSPViolationRate: 38,
        avgAISecurityScore: 58,
        avgAuthenticationScore: 70,
        avgNetworkSecurityScore: 68,
      },
      small: {
        industry: "retail",
        size: "small",
        avgRiskScore: 52,
        avgAnomalyDetectionRate: 62,
        avgDataBreachRisk: 10,
        avgSecurityEventFrequency: 145,
        avgComplianceScore: 72,
        avgCSPViolationRate: 28,
        avgAISecurityScore: 65,
        avgAuthenticationScore: 75,
        avgNetworkSecurityScore: 73,
      },
      medium: {
        industry: "retail",
        size: "medium",
        avgRiskScore: 46,
        avgAnomalyDetectionRate: 70,
        avgDataBreachRisk: 6,
        avgSecurityEventFrequency: 120,
        avgComplianceScore: 80,
        avgCSPViolationRate: 20,
        avgAISecurityScore: 72,
        avgAuthenticationScore: 82,
        avgNetworkSecurityScore: 80,
      },
      large: {
        industry: "retail",
        size: "large",
        avgRiskScore: 40,
        avgAnomalyDetectionRate: 78,
        avgDataBreachRisk: 4,
        avgSecurityEventFrequency: 100,
        avgComplianceScore: 87,
        avgCSPViolationRate: 14,
        avgAISecurityScore: 80,
        avgAuthenticationScore: 88,
        avgNetworkSecurityScore: 87,
      },
      enterprise: {
        industry: "retail",
        size: "enterprise",
        avgRiskScore: 36,
        avgAnomalyDetectionRate: 85,
        avgDataBreachRisk: 2,
        avgSecurityEventFrequency: 80,
        avgComplianceScore: 91,
        avgCSPViolationRate: 9,
        avgAISecurityScore: 86,
        avgAuthenticationScore: 92,
        avgNetworkSecurityScore: 91,
      },
    },
    manufacturing: {
      startup: {
        industry: "manufacturing",
        size: "startup",
        avgRiskScore: 62,
        avgAnomalyDetectionRate: 50,
        avgDataBreachRisk: 16,
        avgSecurityEventFrequency: 160,
        avgComplianceScore: 60,
        avgCSPViolationRate: 40,
        avgAISecurityScore: 55,
        avgAuthenticationScore: 68,
        avgNetworkSecurityScore: 65,
      },
      small: {
        industry: "manufacturing",
        size: "small",
        avgRiskScore: 54,
        avgAnomalyDetectionRate: 58,
        avgDataBreachRisk: 11,
        avgSecurityEventFrequency: 135,
        avgComplianceScore: 68,
        avgCSPViolationRate: 32,
        avgAISecurityScore: 62,
        avgAuthenticationScore: 73,
        avgNetworkSecurityScore: 70,
      },
      medium: {
        industry: "manufacturing",
        size: "medium",
        avgRiskScore: 48,
        avgAnomalyDetectionRate: 66,
        avgDataBreachRisk: 7,
        avgSecurityEventFrequency: 110,
        avgComplianceScore: 76,
        avgCSPViolationRate: 24,
        avgAISecurityScore: 70,
        avgAuthenticationScore: 80,
        avgNetworkSecurityScore: 78,
      },
      large: {
        industry: "manufacturing",
        size: "large",
        avgRiskScore: 42,
        avgAnomalyDetectionRate: 74,
        avgDataBreachRisk: 4,
        avgSecurityEventFrequency: 90,
        avgComplianceScore: 84,
        avgCSPViolationRate: 16,
        avgAISecurityScore: 78,
        avgAuthenticationScore: 86,
        avgNetworkSecurityScore: 84,
      },
      enterprise: {
        industry: "manufacturing",
        size: "enterprise",
        avgRiskScore: 38,
        avgAnomalyDetectionRate: 82,
        avgDataBreachRisk: 2,
        avgSecurityEventFrequency: 70,
        avgComplianceScore: 89,
        avgCSPViolationRate: 10,
        avgAISecurityScore: 84,
        avgAuthenticationScore: 90,
        avgNetworkSecurityScore: 89,
      },
    },
    media: {
      startup: {
        industry: "media",
        size: "startup",
        avgRiskScore: 58,
        avgAnomalyDetectionRate: 52,
        avgDataBreachRisk: 13,
        avgSecurityEventFrequency: 150,
        avgComplianceScore: 62,
        avgCSPViolationRate: 36,
        avgAISecurityScore: 57,
        avgAuthenticationScore: 69,
        avgNetworkSecurityScore: 67,
      },
      small: {
        industry: "media",
        size: "small",
        avgRiskScore: 50,
        avgAnomalyDetectionRate: 60,
        avgDataBreachRisk: 9,
        avgSecurityEventFrequency: 125,
        avgComplianceScore: 70,
        avgCSPViolationRate: 28,
        avgAISecurityScore: 64,
        avgAuthenticationScore: 74,
        avgNetworkSecurityScore: 72,
      },
      medium: {
        industry: "media",
        size: "medium",
        avgRiskScore: 44,
        avgAnomalyDetectionRate: 68,
        avgDataBreachRisk: 5,
        avgSecurityEventFrequency: 100,
        avgComplianceScore: 78,
        avgCSPViolationRate: 20,
        avgAISecurityScore: 72,
        avgAuthenticationScore: 81,
        avgNetworkSecurityScore: 79,
      },
      large: {
        industry: "media",
        size: "large",
        avgRiskScore: 38,
        avgAnomalyDetectionRate: 76,
        avgDataBreachRisk: 3,
        avgSecurityEventFrequency: 80,
        avgComplianceScore: 85,
        avgCSPViolationRate: 13,
        avgAISecurityScore: 80,
        avgAuthenticationScore: 87,
        avgNetworkSecurityScore: 85,
      },
      enterprise: {
        industry: "media",
        size: "enterprise",
        avgRiskScore: 34,
        avgAnomalyDetectionRate: 84,
        avgDataBreachRisk: 1,
        avgSecurityEventFrequency: 60,
        avgComplianceScore: 90,
        avgCSPViolationRate: 8,
        avgAISecurityScore: 86,
        avgAuthenticationScore: 91,
        avgNetworkSecurityScore: 90,
      },
    },
    education: {
      startup: {
        industry: "education",
        size: "startup",
        avgRiskScore: 64,
        avgAnomalyDetectionRate: 48,
        avgDataBreachRisk: 15,
        avgSecurityEventFrequency: 155,
        avgComplianceScore: 58,
        avgCSPViolationRate: 42,
        avgAISecurityScore: 52,
        avgAuthenticationScore: 65,
        avgNetworkSecurityScore: 63,
      },
      small: {
        industry: "education",
        size: "small",
        avgRiskScore: 56,
        avgAnomalyDetectionRate: 56,
        avgDataBreachRisk: 11,
        avgSecurityEventFrequency: 130,
        avgComplianceScore: 66,
        avgCSPViolationRate: 34,
        avgAISecurityScore: 60,
        avgAuthenticationScore: 70,
        avgNetworkSecurityScore: 68,
      },
      medium: {
        industry: "education",
        size: "medium",
        avgRiskScore: 50,
        avgAnomalyDetectionRate: 64,
        avgDataBreachRisk: 7,
        avgSecurityEventFrequency: 105,
        avgComplianceScore: 74,
        avgCSPViolationRate: 26,
        avgAISecurityScore: 68,
        avgAuthenticationScore: 78,
        avgNetworkSecurityScore: 76,
      },
      large: {
        industry: "education",
        size: "large",
        avgRiskScore: 44,
        avgAnomalyDetectionRate: 72,
        avgDataBreachRisk: 4,
        avgSecurityEventFrequency: 85,
        avgComplianceScore: 81,
        avgCSPViolationRate: 18,
        avgAISecurityScore: 76,
        avgAuthenticationScore: 84,
        avgNetworkSecurityScore: 82,
      },
      enterprise: {
        industry: "education",
        size: "enterprise",
        avgRiskScore: 40,
        avgAnomalyDetectionRate: 80,
        avgDataBreachRisk: 2,
        avgSecurityEventFrequency: 65,
        avgComplianceScore: 87,
        avgCSPViolationRate: 11,
        avgAISecurityScore: 82,
        avgAuthenticationScore: 88,
        avgNetworkSecurityScore: 87,
      },
    },
    government: {
      startup: {
        industry: "government",
        size: "startup",
        avgRiskScore: 68,
        avgAnomalyDetectionRate: 55,
        avgDataBreachRisk: 17,
        avgSecurityEventFrequency: 175,
        avgComplianceScore: 72,
        avgCSPViolationRate: 38,
        avgAISecurityScore: 58,
        avgAuthenticationScore: 80,
        avgNetworkSecurityScore: 77,
      },
      small: {
        industry: "government",
        size: "small",
        avgRiskScore: 58,
        avgAnomalyDetectionRate: 63,
        avgDataBreachRisk: 12,
        avgSecurityEventFrequency: 150,
        avgComplianceScore: 80,
        avgCSPViolationRate: 28,
        avgAISecurityScore: 68,
        avgAuthenticationScore: 88,
        avgNetworkSecurityScore: 85,
      },
      medium: {
        industry: "government",
        size: "medium",
        avgRiskScore: 50,
        avgAnomalyDetectionRate: 71,
        avgDataBreachRisk: 7,
        avgSecurityEventFrequency: 120,
        avgComplianceScore: 87,
        avgCSPViolationRate: 20,
        avgAISecurityScore: 76,
        avgAuthenticationScore: 93,
        avgNetworkSecurityScore: 90,
      },
      large: {
        industry: "government",
        size: "large",
        avgRiskScore: 44,
        avgAnomalyDetectionRate: 79,
        avgDataBreachRisk: 4,
        avgSecurityEventFrequency: 95,
        avgComplianceScore: 91,
        avgCSPViolationRate: 13,
        avgAISecurityScore: 83,
        avgAuthenticationScore: 95,
        avgNetworkSecurityScore: 93,
      },
      enterprise: {
        industry: "government",
        size: "enterprise",
        avgRiskScore: 39,
        avgAnomalyDetectionRate: 87,
        avgDataBreachRisk: 2,
        avgSecurityEventFrequency: 72,
        avgComplianceScore: 94,
        avgCSPViolationRate: 8,
        avgAISecurityScore: 89,
        avgAuthenticationScore: 97,
        avgNetworkSecurityScore: 95,
      },
    },
    other: {
      startup: {
        industry: "other",
        size: "startup",
        avgRiskScore: 60,
        avgAnomalyDetectionRate: 58,
        avgDataBreachRisk: 14,
        avgSecurityEventFrequency: 165,
        avgComplianceScore: 65,
        avgCSPViolationRate: 38,
        avgAISecurityScore: 56,
        avgAuthenticationScore: 72,
        avgNetworkSecurityScore: 70,
      },
      small: {
        industry: "other",
        size: "small",
        avgRiskScore: 52,
        avgAnomalyDetectionRate: 66,
        avgDataBreachRisk: 10,
        avgSecurityEventFrequency: 140,
        avgComplianceScore: 73,
        avgCSPViolationRate: 30,
        avgAISecurityScore: 64,
        avgAuthenticationScore: 78,
        avgNetworkSecurityScore: 76,
      },
      medium: {
        industry: "other",
        size: "medium",
        avgRiskScore: 46,
        avgAnomalyDetectionRate: 74,
        avgDataBreachRisk: 6,
        avgSecurityEventFrequency: 115,
        avgComplianceScore: 81,
        avgCSPViolationRate: 22,
        avgAISecurityScore: 72,
        avgAuthenticationScore: 85,
        avgNetworkSecurityScore: 83,
      },
      large: {
        industry: "other",
        size: "large",
        avgRiskScore: 40,
        avgAnomalyDetectionRate: 82,
        avgDataBreachRisk: 4,
        avgSecurityEventFrequency: 95,
        avgComplianceScore: 88,
        avgCSPViolationRate: 15,
        avgAISecurityScore: 80,
        avgAuthenticationScore: 90,
        avgNetworkSecurityScore: 88,
      },
      enterprise: {
        industry: "other",
        size: "enterprise",
        avgRiskScore: 36,
        avgAnomalyDetectionRate: 88,
        avgDataBreachRisk: 2,
        avgSecurityEventFrequency: 75,
        avgComplianceScore: 92,
        avgCSPViolationRate: 9,
        avgAISecurityScore: 86,
        avgAuthenticationScore: 93,
        avgNetworkSecurityScore: 92,
      },
    },
  };

/**
 * Get benchmark for industry and company size
 */
export function getBenchmark(
  industry: Industry,
  size: CompanySize
): RiskBenchmark {
  return INDUSTRY_BENCHMARKS[industry]?.[size] ||
    INDUSTRY_BENCHMARKS["other"]["medium"];
}

/**
 * Compare organization metrics against benchmarks
 */
export function compareToBenchmark(
  industry: Industry,
  size: CompanySize,
  metrics: OrganizationMetrics
): BenchmarkComparison {
  const benchmark = getBenchmark(industry, size);

  const performanceGaps: PerformanceGap[] = [
    {
      metric: "Overall Risk Score",
      organizationScore: metrics.riskScore,
      benchmarkScore: benchmark.avgRiskScore,
      gap: metrics.riskScore - benchmark.avgRiskScore,
      percentile: calculatePercentile(
        metrics.riskScore,
        benchmark.avgRiskScore,
        100
      ),
      recommendation:
        metrics.riskScore > benchmark.avgRiskScore
          ? "リスクスコアが業界平均より高いです。セキュリティ対策を強化してください。"
          : "リスク管理が良好です。現在のセキュリティ体制を維持してください。",
    },
    {
      metric: "Anomaly Detection Rate",
      organizationScore: metrics.anomalyDetectionRate,
      benchmarkScore: benchmark.avgAnomalyDetectionRate,
      gap: metrics.anomalyDetectionRate - benchmark.avgAnomalyDetectionRate,
      percentile: calculatePercentile(
        metrics.anomalyDetectionRate,
        benchmark.avgAnomalyDetectionRate,
        100
      ),
      recommendation:
        metrics.anomalyDetectionRate < benchmark.avgAnomalyDetectionRate
          ? "異常検知率を向上させるために、監視・検知システムを強化してください。"
          : "異常検知能力が優秀です。継続して現在のレベルを維持してください。",
    },
    {
      metric: "Data Breach Risk",
      organizationScore: metrics.dataBreachRisk,
      benchmarkScore: benchmark.avgDataBreachRisk,
      gap: metrics.dataBreachRisk - benchmark.avgDataBreachRisk,
      percentile: calculatePercentile(
        metrics.dataBreachRisk,
        benchmark.avgDataBreachRisk,
        20
      ),
      recommendation:
        metrics.dataBreachRisk > benchmark.avgDataBreachRisk
          ? "データ漏洩リスクが高いです。データ保護メカニズムを強化してください。"
          : "データ保護が良好です。継続して対策を実施してください。",
    },
    {
      metric: "Security Event Frequency",
      organizationScore: metrics.securityEventFrequency,
      benchmarkScore: benchmark.avgSecurityEventFrequency,
      gap: metrics.securityEventFrequency -
        benchmark.avgSecurityEventFrequency,
      percentile: calculatePercentile(
        metrics.securityEventFrequency,
        benchmark.avgSecurityEventFrequency,
        300
      ),
      recommendation:
        metrics.securityEventFrequency > benchmark.avgSecurityEventFrequency * 1.2
          ? "セキュリティイベント頻度が多い可能性があります。根本原因を調査してください。"
          : "セキュリティイベント頻度は正常な範囲内です。",
    },
    {
      metric: "Compliance Score",
      organizationScore: metrics.complianceScore,
      benchmarkScore: benchmark.avgComplianceScore,
      gap: metrics.complianceScore - benchmark.avgComplianceScore,
      percentile: calculatePercentile(
        metrics.complianceScore,
        benchmark.avgComplianceScore,
        100
      ),
      recommendation:
        metrics.complianceScore < benchmark.avgComplianceScore
          ? "コンプライアンス準拠度を向上させるために、ポリシーと手順を整備してください。"
          : "コンプライアンス体制が優秀です。現在の取り組みを継続してください。",
    },
    {
      metric: "CSP Violation Rate",
      organizationScore: metrics.cspViolationRate,
      benchmarkScore: benchmark.avgCSPViolationRate,
      gap: metrics.cspViolationRate - benchmark.avgCSPViolationRate,
      percentile: calculatePercentile(
        metrics.cspViolationRate,
        benchmark.avgCSPViolationRate,
        50
      ),
      recommendation:
        metrics.cspViolationRate > benchmark.avgCSPViolationRate
          ? "CSP違反が多いです。セキュリティ設定を見直してください。"
          : "CSP設定が適切です。",
    },
    {
      metric: "AI Security Score",
      organizationScore: metrics.aiSecurityScore,
      benchmarkScore: benchmark.avgAISecurityScore,
      gap: metrics.aiSecurityScore - benchmark.avgAISecurityScore,
      percentile: calculatePercentile(
        metrics.aiSecurityScore,
        benchmark.avgAISecurityScore,
        100
      ),
      recommendation:
        metrics.aiSecurityScore < benchmark.avgAISecurityScore
          ? "AI関連のセキュリティを強化してください。プロンプトフィルタリングと監視を実装してください。"
          : "AI関連のセキュリティが優秀です。",
    },
    {
      metric: "Authentication Score",
      organizationScore: metrics.authenticationScore,
      benchmarkScore: benchmark.avgAuthenticationScore,
      gap: metrics.authenticationScore - benchmark.avgAuthenticationScore,
      percentile: calculatePercentile(
        metrics.authenticationScore,
        benchmark.avgAuthenticationScore,
        100
      ),
      recommendation:
        metrics.authenticationScore < benchmark.avgAuthenticationScore
          ? "多要素認証(MFA)を導入し、認証メカニズムを強化してください。"
          : "認証体制が優秀です。",
    },
    {
      metric: "Network Security Score",
      organizationScore: metrics.networkSecurityScore,
      benchmarkScore: benchmark.avgNetworkSecurityScore,
      gap: metrics.networkSecurityScore - benchmark.avgNetworkSecurityScore,
      percentile: calculatePercentile(
        metrics.networkSecurityScore,
        benchmark.avgNetworkSecurityScore,
        100
      ),
      recommendation:
        metrics.networkSecurityScore < benchmark.avgNetworkSecurityScore
          ? "ネットワークセキュリティを強化してください。ファイアウォール設定を見直してください。"
          : "ネットワークセキュリティが優秀です。",
    },
  ];

  const overallRanking = calculateRanking(
    metrics,
    benchmark
  );

  const recommendations = performanceGaps
    .filter((g) => g.gap > 5 || g.gap < -5)
    .map((g) => g.recommendation)
    .slice(0, 5);

  return {
    industry,
    size,
    benchmarks: benchmark,
    metrics,
    performanceGaps,
    overallRanking,
    recommendations,
  };
}

/**
 * Calculate percentile (simple linear approximation)
 */
function calculatePercentile(
  value: number,
  benchmark: number,
  maxDeviation: number
): number {
  const normalized = Math.min(
    100,
    Math.max(0, 50 + (value - benchmark) / (maxDeviation / 50))
  );
  return Math.round(normalized);
}

/**
 * Calculate overall ranking
 */
function calculateRanking(
  metrics: OrganizationMetrics,
  benchmark: RiskBenchmark
): BenchmarkRank {
  const gaps = [
    metrics.riskScore - benchmark.avgRiskScore,
    benchmark.avgAnomalyDetectionRate - metrics.anomalyDetectionRate,
    metrics.dataBreachRisk - benchmark.avgDataBreachRisk,
    metrics.cspViolationRate - benchmark.avgCSPViolationRate,
    benchmark.avgComplianceScore - metrics.complianceScore,
    metrics.aiSecurityScore - benchmark.avgAISecurityScore,
  ];

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  if (avgGap <= -15) return "top_performer";
  if (avgGap <= -5) return "above_average";
  if (avgGap <= 5) return "average";
  if (avgGap <= 15) return "below_average";
  return "at_risk";
}
