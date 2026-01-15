/**
 * @fileoverview Pleno Audit Predictive Analysis
 *
 * Local predictive analysis for risk trend detection and forecasting.
 * All processing is local - no external network requests.
 */

// Trend Detection
export {
  detectTrend,
  detectAnomaly,
  movingAverage,
  type DataPoint,
  type TrendResult,
  type AnomalyResult,
} from "./trend-detector.js";

// Risk Forecaster
export {
  createRiskForecaster,
  DEFAULT_FORECAST_CONFIG,
  type RiskForecaster,
  type RiskForecast,
  type RiskEvent,
  type RiskWarning,
  type ForecastConfig,
} from "./risk-forecaster.js";
