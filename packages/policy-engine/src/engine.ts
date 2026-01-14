/**
 * @fileoverview Policy Engine
 *
 * Evaluates security policies against runtime context.
 */

import type {
  PolicyRule,
  PolicyViolation,
  PolicyContext,
  PolicyCondition,
} from "./types.js";
import { DEFAULT_POLICIES } from "./types.js";

/**
 * Generate unique violation ID
 */
function generateViolationId(): string {
  return `viol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  condition: PolicyCondition,
  context: PolicyContext
): boolean {
  const fieldValue = context[condition.field];
  const { operator, value } = condition;

  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "not_equals":
      return fieldValue !== value;
    case "contains":
      return typeof fieldValue === "string" && fieldValue.includes(String(value));
    case "not_contains":
      return typeof fieldValue === "string" && !fieldValue.includes(String(value));
    case "starts_with":
      return typeof fieldValue === "string" && fieldValue.startsWith(String(value));
    case "ends_with":
      return typeof fieldValue === "string" && fieldValue.endsWith(String(value));
    case "matches_regex":
      return typeof fieldValue === "string" && new RegExp(String(value)).test(fieldValue);
    case "greater_than":
      return typeof fieldValue === "number" && fieldValue > Number(value);
    case "less_than":
      return typeof fieldValue === "number" && fieldValue < Number(value);
    case "in_list":
      return Array.isArray(value) && value.includes(fieldValue as string);
    case "not_in_list":
      return Array.isArray(value) && !value.includes(fieldValue as string);
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a rule
 */
function evaluateRule(rule: PolicyRule, context: PolicyContext): boolean {
  if (!rule.enabled) return false;

  const results = rule.conditions.map((c) => evaluateCondition(c, context));

  if (rule.conditionLogic === "and") {
    return results.every((r) => r);
  } else {
    return results.some((r) => r);
  }
}

/**
 * Policy violation listener
 */
export type ViolationListener = (violation: PolicyViolation) => void;

/**
 * Create policy engine
 */
export function createPolicyEngine(customPolicies: PolicyRule[] = []) {
  const policies: Map<string, PolicyRule> = new Map();
  const violations: Map<string, PolicyViolation> = new Map();
  const listeners: Set<ViolationListener> = new Set();

  // Initialize with default and custom policies
  for (const policy of [...DEFAULT_POLICIES, ...customPolicies]) {
    policies.set(policy.id, policy);
  }

  /**
   * Evaluate context against all policies
   */
  function evaluate(context: PolicyContext): PolicyViolation[] {
    const newViolations: PolicyViolation[] = [];

    for (const rule of policies.values()) {
      if (evaluateRule(rule, context)) {
        const violation: PolicyViolation = {
          id: generateViolationId(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          domain: context.domain,
          description: rule.description,
          remediation: rule.remediation,
          timestamp: Date.now(),
          context: { ...context },
          acknowledged: false,
        };

        violations.set(violation.id, violation);
        newViolations.push(violation);

        // Notify listeners
        for (const listener of listeners) {
          try {
            listener(violation);
          } catch {
            // Ignore listener errors
          }
        }
      }
    }

    return newViolations;
  }

  /**
   * Get all violations
   */
  function getViolations(options?: {
    limit?: number;
    severity?: string[];
    category?: string[];
    acknowledged?: boolean;
  }): PolicyViolation[] {
    let result = Array.from(violations.values());

    if (options?.severity) {
      result = result.filter((v) => options.severity!.includes(v.severity));
    }
    if (options?.category) {
      result = result.filter((v) => options.category!.includes(v.category));
    }
    if (options?.acknowledged !== undefined) {
      result = result.filter((v) => v.acknowledged === options.acknowledged);
    }

    result.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Get violation count by severity
   */
  function getViolationStats(): Record<string, number> {
    const stats: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
    };

    for (const v of violations.values()) {
      if (!v.acknowledged) {
        stats[v.severity]++;
        stats.total++;
      }
    }

    return stats;
  }

  /**
   * Acknowledge a violation
   */
  function acknowledgeViolation(violationId: string): void {
    const violation = violations.get(violationId);
    if (violation) {
      violations.set(violationId, { ...violation, acknowledged: true });
    }
  }

  /**
   * Acknowledge all violations
   */
  function acknowledgeAll(): void {
    for (const [id, violation] of violations) {
      violations.set(id, { ...violation, acknowledged: true });
    }
  }

  /**
   * Get all policies
   */
  function getPolicies(): PolicyRule[] {
    return Array.from(policies.values());
  }

  /**
   * Enable/disable a policy
   */
  function setPolityEnabled(policyId: string, enabled: boolean): void {
    const policy = policies.get(policyId);
    if (policy) {
      policies.set(policyId, { ...policy, enabled });
    }
  }

  /**
   * Add custom policy
   */
  function addPolicy(policy: PolicyRule): void {
    policies.set(policy.id, policy);
  }

  /**
   * Remove policy
   */
  function removePolicy(policyId: string): void {
    policies.delete(policyId);
  }

  /**
   * Subscribe to new violations
   */
  function subscribe(listener: ViolationListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Clear all violations
   */
  function clearViolations(): void {
    violations.clear();
  }

  return {
    evaluate,
    getViolations,
    getViolationStats,
    acknowledgeViolation,
    acknowledgeAll,
    getPolicies,
    setPolityEnabled,
    addPolicy,
    removePolicy,
    subscribe,
    clearViolations,
  };
}

export type PolicyEngine = ReturnType<typeof createPolicyEngine>;
