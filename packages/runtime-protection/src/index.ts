/**
 * @fileoverview Runtime Protection Package
 *
 * Wiz Defend-style runtime threat detection for browser security.
 * Real-time monitoring, threat detection, and incident management.
 */

// Types
export type {
  ThreatSeverity,
  ThreatStatus,
  ThreatType,
  DetectionSource,
  RuntimeThreat,
  ThreatIndicator,
  ThreatContext,
  MitigationAction,
  MitigationActionType,
  ThreatEvent,
  SecurityIncident,
  IncidentEvent,
  RuntimeProtectionConfig,
  ThreatDetectionRule,
  ThreatCondition,
  RuntimeStats,
} from "./types.js";

export { DEFAULT_RUNTIME_CONFIG } from "./types.js";

// Detector
export {
  createRuntimeProtector,
  createInMemoryRuntimeStore,
  type RuntimeProtector,
  type RuntimeProtectionStore,
  type ThreatListener,
  type ThreatDetectionEvent,
} from "./detector.js";
