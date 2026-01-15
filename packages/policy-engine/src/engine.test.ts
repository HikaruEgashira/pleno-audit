import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPolicyEngine } from "./engine.js";
import type { PolicyRule, PolicyContext } from "./types.js";

describe("createPolicyEngine", () => {
  describe("basic initialization", () => {
    it("creates engine with default policies", () => {
      const engine = createPolicyEngine();
      const policies = engine.getPolicies();
      expect(policies.length).toBeGreaterThan(0);
    });

    it("creates engine with custom policies", () => {
      const customPolicy: PolicyRule = {
        id: "custom-001",
        name: "Custom Rule",
        description: "Test policy",
        category: "data_protection",
        severity: "low",
        enabled: true,
        conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
        conditionLogic: "and",
        remediation: "Test remediation",
        tags: ["test"],
      };
      const engine = createPolicyEngine([customPolicy]);
      const policies = engine.getPolicies();
      expect(policies.some((p) => p.id === "custom-001")).toBe(true);
    });
  });

  describe("condition evaluation", () => {
    it("evaluates equals operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-eq",
          name: "Equals Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "equals", value: "example.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "example.com" });
      expect(violations.some((v) => v.ruleId === "test-eq")).toBe(true);
    });

    it("evaluates not_equals operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-neq",
          name: "Not Equals Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "not_equals", value: "safe.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "dangerous.com" });
      expect(violations.some((v) => v.ruleId === "test-neq")).toBe(true);
    });

    it("evaluates contains operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-contains",
          name: "Contains Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "contains", value: "phish" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "phishing-site.com" });
      expect(violations.some((v) => v.ruleId === "test-contains")).toBe(true);
    });

    it("evaluates not_contains operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-not-contains",
          name: "Not Contains Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "not_contains", value: "safe" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "danger.com" });
      expect(violations.some((v) => v.ruleId === "test-not-contains")).toBe(true);
    });

    it("evaluates starts_with operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-starts",
          name: "Starts With Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "starts_with", value: "api." }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "api.example.com" });
      expect(violations.some((v) => v.ruleId === "test-starts")).toBe(true);
    });

    it("evaluates ends_with operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-ends",
          name: "Ends With Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "ends_with", value: ".xyz" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "suspicious.xyz" });
      expect(violations.some((v) => v.ruleId === "test-ends")).toBe(true);
    });

    it("evaluates matches_regex operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-regex",
          name: "Regex Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "matches_regex", value: "^[0-9]+\\." }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "123.example.com" });
      expect(violations.some((v) => v.ruleId === "test-regex")).toBe(true);
    });

    it("evaluates greater_than operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-gt",
          name: "Greater Than Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "cspViolationCount", operator: "greater_than", value: 5 }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "test.com", cspViolationCount: 10 });
      expect(violations.some((v) => v.ruleId === "test-gt")).toBe(true);
    });

    it("evaluates less_than operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-lt",
          name: "Less Than Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "cookieCount", operator: "less_than", value: 3 }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "test.com", cookieCount: 1 });
      expect(violations.some((v) => v.ruleId === "test-lt")).toBe(true);
    });

    it("evaluates in_list operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-in",
          name: "In List Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [
            { field: "aiProvider", operator: "in_list", value: ["openai", "anthropic"] },
          ],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "test.com", aiProvider: "openai" });
      expect(violations.some((v) => v.ruleId === "test-in")).toBe(true);
    });

    it("evaluates not_in_list operator", () => {
      const engine = createPolicyEngine([
        {
          id: "test-not-in",
          name: "Not In List Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [
            { field: "aiProvider", operator: "not_in_list", value: ["safe-ai", "trusted-ai"] },
          ],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "test.com", aiProvider: "unknown-ai" });
      expect(violations.some((v) => v.ruleId === "test-not-in")).toBe(true);
    });
  });

  describe("condition logic", () => {
    it("applies AND logic - all conditions must match", () => {
      const engine = createPolicyEngine([
        {
          id: "test-and",
          name: "AND Logic Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [
            { field: "isNRD", operator: "equals", value: true },
            { field: "hasLogin", operator: "equals", value: true },
          ],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      // Both conditions match
      const violations1 = engine.evaluate({ domain: "test.com", isNRD: true, hasLogin: true });
      expect(violations1.some((v) => v.ruleId === "test-and")).toBe(true);

      // Only one condition matches
      engine.clearViolations();
      const violations2 = engine.evaluate({ domain: "test.com", isNRD: true, hasLogin: false });
      expect(violations2.some((v) => v.ruleId === "test-and")).toBe(false);
    });

    it("applies OR logic - any condition can match", () => {
      const engine = createPolicyEngine([
        {
          id: "test-or",
          name: "OR Logic Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [
            { field: "isNRD", operator: "equals", value: true },
            { field: "isTyposquat", operator: "equals", value: true },
          ],
          conditionLogic: "or",
          remediation: "",
          tags: [],
        },
      ]);

      // Only one condition matches
      const violations = engine.evaluate({
        domain: "test.com",
        isNRD: true,
        isTyposquat: false,
      });
      expect(violations.some((v) => v.ruleId === "test-or")).toBe(true);
    });
  });

  describe("disabled policies", () => {
    it("does not evaluate disabled policies", () => {
      const engine = createPolicyEngine([
        {
          id: "test-disabled",
          name: "Disabled Test",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: false,
          conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const violations = engine.evaluate({ domain: "test.com" });
      expect(violations.some((v) => v.ruleId === "test-disabled")).toBe(false);
    });
  });

  describe("violation management", () => {
    let engine: ReturnType<typeof createPolicyEngine>;

    beforeEach(() => {
      engine = createPolicyEngine([
        {
          id: "test-rule",
          name: "Test Rule",
          description: "Test",
          category: "data_protection",
          severity: "high",
          enabled: true,
          conditions: [{ field: "isNRD", operator: "equals", value: true }],
          conditionLogic: "and",
          remediation: "Fix it",
          tags: ["test"],
        },
      ]);
    });

    it("stores violations after evaluation", () => {
      engine.evaluate({ domain: "test.com", isNRD: true });
      const violations = engine.getViolations();
      expect(violations.length).toBeGreaterThan(0);
    });

    it("filters violations by severity", () => {
      engine.evaluate({ domain: "test.com", isNRD: true });
      const highViolations = engine.getViolations({ severity: ["high"] });
      const lowViolations = engine.getViolations({ severity: ["low"] });
      expect(highViolations.length).toBeGreaterThan(0);
      expect(lowViolations.length).toBe(0);
    });

    it("filters violations by acknowledged status", () => {
      engine.evaluate({ domain: "test.com", isNRD: true });
      const violations = engine.getViolations();
      const violationId = violations[0].id;

      engine.acknowledgeViolation(violationId);

      const unacked = engine.getViolations({ acknowledged: false });
      const acked = engine.getViolations({ acknowledged: true });

      expect(acked.some((v) => v.id === violationId)).toBe(true);
      expect(unacked.some((v) => v.id === violationId)).toBe(false);
    });

    it("acknowledges all violations", () => {
      engine.evaluate({ domain: "test1.com", isNRD: true });
      engine.evaluate({ domain: "test2.com", isNRD: true });

      engine.acknowledgeAll();

      const unacked = engine.getViolations({ acknowledged: false });
      expect(unacked.length).toBe(0);
    });

    it("limits returned violations", () => {
      engine.evaluate({ domain: "test1.com", isNRD: true });
      engine.evaluate({ domain: "test2.com", isNRD: true });
      engine.evaluate({ domain: "test3.com", isNRD: true });

      const limited = engine.getViolations({ limit: 2 });
      expect(limited.length).toBe(2);
    });

    it("clears all violations", () => {
      engine.evaluate({ domain: "test.com", isNRD: true });
      engine.clearViolations();
      const violations = engine.getViolations();
      expect(violations.length).toBe(0);
    });
  });

  describe("violation stats", () => {
    it("counts violations by severity", () => {
      const engine = createPolicyEngine([
        {
          id: "high-rule",
          name: "High",
          description: "",
          category: "data_protection",
          severity: "high",
          enabled: true,
          conditions: [{ field: "isNRD", operator: "equals", value: true }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
        {
          id: "critical-rule",
          name: "Critical",
          description: "",
          category: "data_protection",
          severity: "critical",
          enabled: true,
          conditions: [{ field: "isTyposquat", operator: "equals", value: true }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      engine.evaluate({ domain: "test.com", isNRD: true, isTyposquat: true });
      const stats = engine.getViolationStats();

      // Default policies also fire: dp-001 (high) for NRD, dp-002 (critical) for typosquat
      expect(stats.high).toBeGreaterThanOrEqual(1);
      expect(stats.critical).toBeGreaterThanOrEqual(1);
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it("excludes acknowledged violations from stats", () => {
      const engine = createPolicyEngine([
        {
          id: "test-rule",
          name: "Test",
          description: "",
          category: "data_protection",
          severity: "high",
          enabled: true,
          conditions: [{ field: "isNRD", operator: "equals", value: true }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      engine.evaluate({ domain: "test.com", isNRD: true });
      engine.acknowledgeAll();
      const stats = engine.getViolationStats();

      expect(stats.total).toBe(0);
    });
  });

  describe("policy management", () => {
    it("enables and disables policies", () => {
      const engine = createPolicyEngine([
        {
          id: "toggle-rule",
          name: "Toggle",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      // Initially enabled
      let violations = engine.evaluate({ domain: "test.com" });
      expect(violations.some((v) => v.ruleId === "toggle-rule")).toBe(true);

      // Disable
      engine.clearViolations();
      engine.setPolityEnabled("toggle-rule", false);
      violations = engine.evaluate({ domain: "test.com" });
      expect(violations.some((v) => v.ruleId === "toggle-rule")).toBe(false);

      // Re-enable
      engine.setPolityEnabled("toggle-rule", true);
      violations = engine.evaluate({ domain: "test.com" });
      expect(violations.some((v) => v.ruleId === "toggle-rule")).toBe(true);
    });

    it("adds new policies", () => {
      const engine = createPolicyEngine();
      const initialCount = engine.getPolicies().length;

      engine.addPolicy({
        id: "new-policy",
        name: "New Policy",
        description: "",
        category: "data_protection",
        severity: "low",
        enabled: true,
        conditions: [],
        conditionLogic: "and",
        remediation: "",
        tags: [],
      });

      expect(engine.getPolicies().length).toBe(initialCount + 1);
    });

    it("removes policies", () => {
      const engine = createPolicyEngine([
        {
          id: "remove-me",
          name: "Remove Me",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      engine.removePolicy("remove-me");
      expect(engine.getPolicies().some((p) => p.id === "remove-me")).toBe(false);
    });
  });

  describe("subscription", () => {
    it("notifies listeners on new violations", () => {
      const engine = createPolicyEngine([
        {
          id: "notify-rule",
          name: "Notify",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const listener = vi.fn();
      engine.subscribe(listener);

      engine.evaluate({ domain: "test.com" });

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].ruleId).toBe("notify-rule");
    });

    it("unsubscribes listeners", () => {
      const engine = createPolicyEngine([
        {
          id: "unsub-rule",
          name: "Unsub",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);
      unsubscribe();

      engine.evaluate({ domain: "test.com" });

      expect(listener).not.toHaveBeenCalled();
    });

    it("handles listener errors gracefully", () => {
      const engine = createPolicyEngine([
        {
          id: "error-rule",
          name: "Error",
          description: "",
          category: "data_protection",
          severity: "low",
          enabled: true,
          conditions: [{ field: "domain", operator: "equals", value: "test.com" }],
          conditionLogic: "and",
          remediation: "",
          tags: [],
        },
      ]);

      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      engine.subscribe(errorListener);
      engine.subscribe(normalListener);

      // Should not throw
      expect(() => engine.evaluate({ domain: "test.com" })).not.toThrow();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe("default policies", () => {
    it("detects NRD sites with dp-001", () => {
      const engine = createPolicyEngine();
      const violations = engine.evaluate({ domain: "new-site.xyz", isNRD: true });
      expect(violations.some((v) => v.ruleId === "dp-001")).toBe(true);
    });

    it("detects typosquat domains with dp-002", () => {
      const engine = createPolicyEngine();
      const violations = engine.evaluate({ domain: "g00gle.com", isTyposquat: true });
      expect(violations.some((v) => v.ruleId === "dp-002")).toBe(true);
    });

    it("detects sensitive data to AI with ai-002", () => {
      const engine = createPolicyEngine();
      const violations = engine.evaluate({
        domain: "chat.openai.com",
        isAIProvider: true,
        hasSensitiveData: true,
      });
      expect(violations.some((v) => v.ruleId === "ai-002")).toBe(true);
    });

    it("detects missing privacy policy with priv-001", () => {
      const engine = createPolicyEngine();
      const violations = engine.evaluate({
        domain: "no-privacy.com",
        hasLogin: true,
        hasPrivacyPolicy: false,
      });
      expect(violations.some((v) => v.ruleId === "priv-001")).toBe(true);
    });

    it("detects excessive CSP violations with net-001", () => {
      const engine = createPolicyEngine();
      const violations = engine.evaluate({
        domain: "csp-mess.com",
        cspViolationCount: 15,
      });
      expect(violations.some((v) => v.ruleId === "net-001")).toBe(true);
    });
  });
});
