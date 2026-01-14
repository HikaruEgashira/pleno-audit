/**
 * @fileoverview Security Graph Package
 *
 * Wiz-style security graph for visualizing domain connections,
 * data flows, risk relationships, and attack paths.
 *
 * Main features:
 * - Graph-based security visualization
 * - Risk scoring and prioritization
 * - Sensitive data detection (DSPM)
 * - Attack path identification
 */

// Types
export type {
  NodeType,
  EdgeType,
  RiskLevel,
  GraphNode,
  GraphEdge,
  NodeMetadata,
  DomainMetadata,
  AIProviderMetadata,
  ExtensionMetadata,
  DataTypeMetadata,
  DataClassification,
  SecurityGraph,
  GraphStats,
  AttackPath,
  GraphQueryOptions,
  SerializedGraph,
} from "./types.js";

// Risk Calculator
export {
  calculateRiskScore,
  scoreToRiskLevel,
  riskLevelPriority,
  getRiskColor,
  type RiskFactors,
} from "./risk-calculator.js";

// Sensitive Data Detection
export {
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
  type SensitiveDataResult,
} from "./sensitive-data-detector.js";

// Graph Builder
export {
  createSecurityGraph,
  buildSecurityGraph,
  serializeGraph,
  deserializeGraph,
} from "./graph-builder.js";
