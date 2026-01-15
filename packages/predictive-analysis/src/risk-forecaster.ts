/**
 * @fileoverview Risk Forecaster
 *
 * Predicts future risk levels based on historical local data.
 * All processing is local - no external data or network requests.
 */

import {
  detectTrend,
  detectAnomaly,
  movingAverage,
  type DataPoint,
  type TrendResult,
  type AnomalyResult,
} from "./trend-detector.js";

// ============================================================================
// Types
// ============================================================================

export interface RiskEvent {
  timestamp: number;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  domain?: string;
}

export interface RiskForecast {
  currentRiskLevel: number;
  predictedRiskLevel: number;
  trend: TrendResult;
  anomalies: AnomalyResult[];
  warnings: RiskWarning[];
  forecastPeriod: string;
  confidence: number;
  generatedAt: number;
}

export interface RiskWarning {
  type: "trend_increase" | "anomaly_detected" | "high_activity" | "pattern_detected";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  recommendation: string;
}

export interface ForecastConfig {
  windowDays: number;
  forecastDays: number;
  anomalyThreshold: number;
  trendThreshold: number;
}

export const DEFAULT_FORECAST_CONFIG: ForecastConfig = {
  windowDays: 7,
  forecastDays: 3,
  anomalyThreshold: 2.5,
  trendThreshold: 0.15,
};

// ============================================================================
// Risk Score Calculation
// ============================================================================

const SEVERITY_WEIGHTS: Record<RiskEvent["severity"], number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

/**
 * Calculate daily risk scores from events
 */
function calculateDailyRiskScores(events: RiskEvent[]): DataPoint[] {
  if (events.length === 0) return [];

  // Group events by day
  const dailyScores = new Map<string, number>();

  for (const event of events) {
    const date = new Date(event.timestamp).toISOString().split("T")[0];
    const weight = SEVERITY_WEIGHTS[event.severity];
    dailyScores.set(date, (dailyScores.get(date) || 0) + weight);
  }

  // Convert to DataPoint array
  return Array.from(dailyScores.entries())
    .map(([date, score]) => ({
      timestamp: new Date(date).getTime(),
      value: score,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate current risk level (0-100)
 */
function calculateCurrentRiskLevel(recentEvents: RiskEvent[]): number {
  if (recentEvents.length === 0) return 0;

  const totalWeight = recentEvents.reduce(
    (sum, e) => sum + SEVERITY_WEIGHTS[e.severity],
    0
  );

  // Normalize to 0-100 scale (assuming max ~50 weighted events per day is very high)
  return Math.min(100, Math.round((totalWeight / 50) * 100));
}

// ============================================================================
// Warning Generation
// ============================================================================

function generateWarnings(
  trend: TrendResult,
  anomalies: AnomalyResult[],
  currentRiskLevel: number
): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  // Check for increasing trend
  if (trend.direction === "increasing" && trend.confidence > 0.5) {
    const severity = trend.percentChange > 50 ? "high" : "medium";
    warnings.push({
      type: "trend_increase",
      severity,
      message: `リスクイベントが${Math.round(trend.percentChange)}%増加傾向`,
      recommendation: "セキュリティ設定の見直しを推奨します",
    });
  }

  // Check for anomalies
  const criticalAnomalies = anomalies.filter((a) => a.isAnomaly && a.severity === "critical");
  const highAnomalies = anomalies.filter((a) => a.isAnomaly && a.severity === "high");

  if (criticalAnomalies.length > 0) {
    warnings.push({
      type: "anomaly_detected",
      severity: "critical",
      message: `重大な異常検知: ${criticalAnomalies.length}件`,
      recommendation: "即座にセキュリティ状況を確認してください",
    });
  } else if (highAnomalies.length > 0) {
    warnings.push({
      type: "anomaly_detected",
      severity: "high",
      message: `高リスク異常検知: ${highAnomalies.length}件`,
      recommendation: "セキュリティイベントを確認してください",
    });
  }

  // Check for high activity
  if (currentRiskLevel >= 70) {
    warnings.push({
      type: "high_activity",
      severity: "high",
      message: `現在のリスクレベルが高い (${currentRiskLevel}/100)`,
      recommendation: "保護機能の有効化を検討してください",
    });
  } else if (currentRiskLevel >= 50) {
    warnings.push({
      type: "high_activity",
      severity: "medium",
      message: `リスクレベルが上昇中 (${currentRiskLevel}/100)`,
      recommendation: "セキュリティ設定を確認してください",
    });
  }

  return warnings;
}

// ============================================================================
// Risk Forecaster
// ============================================================================

/**
 * Create risk forecaster instance
 */
export function createRiskForecaster(
  config: ForecastConfig = DEFAULT_FORECAST_CONFIG
) {
  let currentConfig = { ...config };

  /**
   * Update configuration
   */
  function updateConfig(updates: Partial<ForecastConfig>): void {
    currentConfig = { ...currentConfig, ...updates };
  }

  /**
   * Get current configuration
   */
  function getConfig(): ForecastConfig {
    return { ...currentConfig };
  }

  /**
   * Generate risk forecast from events
   */
  function forecast(events: RiskEvent[]): RiskForecast {
    const now = Date.now();
    const windowMs = currentConfig.windowDays * 24 * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    // Filter to recent events
    const recentEvents = events.filter((e) => e.timestamp >= windowStart);

    // Calculate daily risk scores
    const dailyScores = calculateDailyRiskScores(recentEvents);

    // Get smoothed data for trend analysis
    const smoothedData = dailyScores.length >= 3
      ? movingAverage(dailyScores, Math.min(3, dailyScores.length))
      : dailyScores;

    // Detect trend
    const trend = detectTrend(smoothedData, {
      minPoints: 3,
      slopeThreshold: currentConfig.trendThreshold,
    });

    // Detect anomalies for each day
    const anomalies: AnomalyResult[] = [];
    for (let i = 5; i < dailyScores.length; i++) {
      const historical = dailyScores.slice(0, i);
      const anomaly = detectAnomaly(historical, dailyScores[i].value, {
        zScoreThreshold: currentConfig.anomalyThreshold,
        minDataPoints: 5,
      });
      if (anomaly.isAnomaly) {
        anomalies.push({
          ...anomaly,
          timestamp: dailyScores[i].timestamp,
        });
      }
    }

    // Calculate current and predicted risk levels
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayEvents = recentEvents.filter((e) => e.timestamp >= todayStart);
    const currentRiskLevel = calculateCurrentRiskLevel(todayEvents);

    // Predict future risk based on trend
    let predictedRiskLevel = currentRiskLevel;
    if (trend.direction === "increasing") {
      predictedRiskLevel = Math.min(100, currentRiskLevel + Math.round(trend.slope * currentConfig.forecastDays * 10));
    } else if (trend.direction === "decreasing") {
      predictedRiskLevel = Math.max(0, currentRiskLevel + Math.round(trend.slope * currentConfig.forecastDays * 10));
    }

    // Generate warnings
    const warnings = generateWarnings(trend, anomalies, currentRiskLevel);

    return {
      currentRiskLevel,
      predictedRiskLevel,
      trend,
      anomalies,
      warnings,
      forecastPeriod: `${currentConfig.forecastDays}日後`,
      confidence: trend.confidence,
      generatedAt: now,
    };
  }

  /**
   * Quick check if there are any warnings
   */
  function hasWarnings(events: RiskEvent[]): boolean {
    const result = forecast(events);
    return result.warnings.length > 0;
  }

  return {
    updateConfig,
    getConfig,
    forecast,
    hasWarnings,
  };
}

export type RiskForecaster = ReturnType<typeof createRiskForecaster>;
