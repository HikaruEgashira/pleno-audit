/**
 * @fileoverview Trend Detection
 *
 * Detects trends in risk data using simple statistical methods.
 * All processing is local - no external data or network requests.
 */

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
  category?: string;
}

export interface TrendResult {
  direction: "increasing" | "decreasing" | "stable";
  slope: number;
  confidence: number;
  percentChange: number;
  dataPoints: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: "critical" | "high" | "medium" | "low" | "none";
  deviation: number;
  threshold: number;
  timestamp: number;
  value: number;
}

// ============================================================================
// Statistical Helpers
// ============================================================================

/**
 * Calculate mean of values
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate linear regression slope
 */
function linearRegressionSlope(points: DataPoint[]): number {
  if (points.length < 2) return 0;

  const n = points.length;
  const xValues = points.map((_, i) => i);
  const yValues = points.map((p) => p.value);

  const xMean = mean(xValues);
  const yMean = mean(yValues);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += Math.pow(xValues[i] - xMean, 2);
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate R-squared (coefficient of determination)
 */
function rSquared(points: DataPoint[], slope: number): number {
  if (points.length < 2) return 0;

  const yValues = points.map((p) => p.value);
  const yMean = mean(yValues);
  const xMean = mean(points.map((_, i) => i));

  // Calculate predicted values
  const predicted = points.map((_, i) => yMean + slope * (i - xMean));

  // Calculate SS_res and SS_tot
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < points.length; i++) {
    ssRes += Math.pow(yValues[i] - predicted[i], 2);
    ssTot += Math.pow(yValues[i] - yMean, 2);
  }

  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

// ============================================================================
// Trend Detection
// ============================================================================

/**
 * Detect trend in data points
 */
export function detectTrend(
  points: DataPoint[],
  options: {
    minPoints?: number;
    slopeThreshold?: number;
  } = {}
): TrendResult {
  const { minPoints = 3, slopeThreshold = 0.1 } = options;

  if (points.length < minPoints) {
    return {
      direction: "stable",
      slope: 0,
      confidence: 0,
      percentChange: 0,
      dataPoints: points.length,
    };
  }

  // Sort by timestamp
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);

  // Calculate slope
  const slope = linearRegressionSlope(sorted);
  const confidence = rSquared(sorted, slope);

  // Calculate percent change
  const firstValue = sorted[0].value;
  const lastValue = sorted[sorted.length - 1].value;
  const percentChange =
    firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

  // Determine direction
  let direction: TrendResult["direction"];
  if (Math.abs(slope) < slopeThreshold) {
    direction = "stable";
  } else if (slope > 0) {
    direction = "increasing";
  } else {
    direction = "decreasing";
  }

  return {
    direction,
    slope,
    confidence,
    percentChange,
    dataPoints: points.length,
  };
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/**
 * Detect anomalies using Z-score method
 */
export function detectAnomaly(
  points: DataPoint[],
  currentValue: number,
  options: {
    zScoreThreshold?: number;
    minDataPoints?: number;
  } = {}
): AnomalyResult {
  const { zScoreThreshold = 2.5, minDataPoints = 5 } = options;

  const values = points.map((p) => p.value);

  if (values.length < minDataPoints) {
    return {
      isAnomaly: false,
      severity: "none",
      deviation: 0,
      threshold: zScoreThreshold,
      timestamp: Date.now(),
      value: currentValue,
    };
  }

  const avg = mean(values);
  const std = standardDeviation(values);

  // Calculate Z-score
  const zScore = std === 0 ? 0 : Math.abs((currentValue - avg) / std);

  // Determine severity based on Z-score
  let severity: AnomalyResult["severity"];
  if (zScore >= 4) {
    severity = "critical";
  } else if (zScore >= 3) {
    severity = "high";
  } else if (zScore >= 2.5) {
    severity = "medium";
  } else if (zScore >= 2) {
    severity = "low";
  } else {
    severity = "none";
  }

  return {
    isAnomaly: zScore >= zScoreThreshold,
    severity,
    deviation: zScore,
    threshold: zScoreThreshold,
    timestamp: Date.now(),
    value: currentValue,
  };
}

// ============================================================================
// Moving Average
// ============================================================================

/**
 * Calculate simple moving average
 */
export function movingAverage(
  points: DataPoint[],
  windowSize: number
): DataPoint[] {
  if (points.length < windowSize) {
    return [];
  }

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const result: DataPoint[] = [];

  for (let i = windowSize - 1; i < sorted.length; i++) {
    const window = sorted.slice(i - windowSize + 1, i + 1);
    const avg = mean(window.map((p) => p.value));
    result.push({
      timestamp: sorted[i].timestamp,
      value: avg,
    });
  }

  return result;
}
