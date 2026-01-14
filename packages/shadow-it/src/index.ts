/**
 * @fileoverview Shadow IT Detection Package
 *
 * Detects unauthorized SaaS and cloud services for enterprise security.
 * Wiz-style Shadow IT discovery for browser-based CASB.
 */

// Types
export type {
  ServiceCategory,
  ShadowITRisk,
  SaaSServiceDefinition,
  DetectedShadowIT,
  ShadowITConfig,
  ShadowITSummary,
} from "./types.js";

export {
  DEFAULT_SHADOW_IT_CONFIG,
  KNOWN_SAAS_SERVICES,
} from "./types.js";

// Detector
export {
  createShadowITDetector,
  createInMemoryShadowITStore,
  type ShadowITDetector,
  type ShadowITStore,
  type ShadowITListener,
} from "./detector.js";
