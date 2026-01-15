/**
 * @fileoverview Risk Prioritization Package
 *
 * Wiz-style risk prioritization with context-aware scoring.
 * Focuses remediation on exploitable paths and business impact.
 */

// Types
export type {
  RiskSeverity,
  RiskCategory,
  RiskFactor,
  PrioritizedRisk,
  RiskImpact,
  RemediationAction,
  RemediationType,
  RiskSummary,
  RiskTrend,
} from "./types.js";

export { RISK_WEIGHTS, SEVERITY_THRESHOLDS } from "./types.js";

// Prioritizer
export {
  createRiskPrioritizer,
  type RiskPrioritizer,
  type RiskInput,
} from "./prioritizer.js";

// Benchmark
export {
  compareToBenchmark,
  type Industry,
  type CompanySize,
  type RiskBenchmark,
  type OrganizationMetrics,
  type BenchmarkComparison,
  type PerformanceGap,
  type BenchmarkRank,
} from "./benchmark.js";
