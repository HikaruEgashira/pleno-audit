/**
 * @fileoverview Alert System Package (Shim)
 *
 * This package is a backward-compatibility shim that re-exports from ZTA packages.
 * New code should import directly from @pleno-audit/policy-engine and @pleno-audit/pep.
 *
 * @deprecated Import from @pleno-audit/policy-engine or @pleno-audit/pep instead
 */

// Re-export from policy-engine
export {
  createPolicyManager,
  type PolicyManager,
  type PolicyCheckResult,
  type PolicyAction,
  type PolicyMatchType,
  type DomainPolicyRule,
  type ToolPolicyRule,
  type AIPolicyRule,
  type DataTransferPolicyRule,
  type PolicyConfig,
  type PolicyViolation,
  DEFAULT_POLICY_CONFIG,
  POLICY_TEMPLATES,
  SOCIAL_MEDIA_DOMAINS,
  PRODUCTIVITY_DOMAINS,
  COMMUNICATION_DOMAINS,
} from "@pleno-audit/policy-engine";

// Re-export from pep
export {
  createAlertManager,
  createInMemoryAlertStore,
  type AlertManager,
  type AlertStore,
  type AlertListener,
  type AlertSeverity,
  type AlertCategory,
  type AlertStatus,
  type SecurityAlert,
  type AlertDetails,
  type NRDAlertDetails,
  type TyposquatAlertDetails,
  type DataLeakAlertDetails,
  type DataExfiltrationAlertDetails,
  type CredentialTheftAlertDetails,
  type SupplyChainAlertDetails,
  type CSPAlertDetails,
  type AISensitiveAlertDetails,
  type ShadowAIAlertDetails,
  type ExtensionAlertDetails,
  type LoginAlertDetails,
  type PolicyAlertDetails,
  type ComplianceAlertDetails,
  type PolicyViolationAlertDetails,
  type AlertAction,
  type AlertRule,
  type AlertCondition,
  type AlertConfig,
  DEFAULT_ALERT_CONFIG,
  DEFAULT_ALERT_RULES,
} from "@pleno-audit/pep";
