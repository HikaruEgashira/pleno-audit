/**
 * @fileoverview Policy Engine Package
 *
 * Custom security policy definitions and violation detection.
 * Wiz-style policy-as-code for browser security.
 */

// Types
export type {
  PolicySeverity,
  PolicyCategory,
  ConditionOperator,
  PolicyCondition,
  PolicyRule,
  PolicyViolation,
  PolicyContext,
} from "./types.js";

export { DEFAULT_POLICIES } from "./types.js";

// Engine
export {
  createPolicyEngine,
  type PolicyEngine,
  type ViolationListener,
} from "./engine.js";
