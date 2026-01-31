// Policy Types
export type {
  PolicyAction,
  PolicyMatchType,
  DomainPolicyRule,
  ToolPolicyRule,
  AIPolicyRule,
  DataTransferPolicyRule,
  PolicyConfig,
  PolicyViolation,
} from "./policy-types.js";
export {
  DEFAULT_POLICY_CONFIG,
  POLICY_TEMPLATES,
  SOCIAL_MEDIA_DOMAINS,
  PRODUCTIVITY_DOMAINS,
  COMMUNICATION_DOMAINS,
} from "./policy-types.js";

// Policy Manager
export {
  createPolicyManager,
  type PolicyCheckResult,
  type PolicyManager,
} from "./policy-manager.js";

// Trust Algorithm
export {
  computeTrustScore,
  createTrustAlgorithm,
  DEFAULT_TRUST_INPUT,
  type TrustLevel,
  type Confidence,
  type TrustFactor,
  type TrustInput,
  type TrustScore,
  type TrustAlgorithm,
} from "./trust-algorithm.js";
