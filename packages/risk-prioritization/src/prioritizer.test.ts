import { describe, it, expect } from "vitest";
import { createRiskPrioritizer, type RiskInput } from "./prioritizer.js";

function createTestInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    domain: "example.com",
    isNRD: false,
    isTyposquat: false,
    hasLogin: false,
    hasPrivacyPolicy: true,
    cookieCount: 0,
    sessionCookies: 0,
    aiPromptsCount: 0,
    sensitiveDataTypes: [],
    extensionRequests: 0,
    policyViolations: 0,
    ...overrides,
  };
}

describe("createRiskPrioritizer", () => {
  describe("analyzeRisk", () => {
    it("returns low risk for clean domain", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput());

      expect(result.score).toBe(0);
      expect(result.severity).toBe("info");
      expect(result.factors).toHaveLength(0);
    });

    it("assigns high risk for NRD", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
        nrdConfidence: "high",
      }));

      expect(result.score).toBeGreaterThan(0);
      expect(result.factors.some((f) => f.id === "nrd")).toBe(true);
    });

    it("assigns higher risk for high confidence NRD", () => {
      const prioritizer = createRiskPrioritizer();

      const lowConfidence = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
        nrdConfidence: "low",
      }));

      const highConfidence = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
        nrdConfidence: "high",
      }));

      expect(highConfidence.score).toBeGreaterThan(lowConfidence.score);
    });

    it("assigns high risk for typosquat", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isTyposquat: true,
        typosquatTarget: "google.com",
      }));

      expect(result.score).toBeGreaterThan(30);
      expect(result.factors.some((f) => f.id === "typosquat")).toBe(true);
      expect(result.title).toContain("タイポスクワット");
    });

    it("detects login without privacy policy", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        hasLogin: true,
        hasPrivacyPolicy: false,
      }));

      expect(result.factors.some((f) => f.id === "login_no_privacy")).toBe(true);
    });

    it("allows login with privacy policy", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        hasLogin: true,
        hasPrivacyPolicy: true,
      }));

      expect(result.factors.some((f) => f.id === "login_no_privacy")).toBe(false);
    });

    it("detects session cookies on suspicious domain", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
        sessionCookies: 3,
      }));

      expect(result.factors.some((f) => f.id === "session_suspicious")).toBe(true);
    });

    it("ignores session cookies on normal domain", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isNRD: false,
        isTyposquat: false,
        sessionCookies: 3,
      }));

      expect(result.factors.some((f) => f.id === "session_suspicious")).toBe(false);
    });

    it("detects AI data risk", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        aiPromptsCount: 5,
      }));

      expect(result.factors.some((f) => f.id === "ai_data")).toBe(true);
    });

    it("assigns higher AI risk for sensitive data", () => {
      const prioritizer = createRiskPrioritizer();

      const noSensitive = prioritizer.analyzeRisk(createTestInput({
        aiPromptsCount: 5,
        sensitiveDataTypes: [],
      }));

      const withSensitive = prioritizer.analyzeRisk(createTestInput({
        aiPromptsCount: 5,
        sensitiveDataTypes: ["credentials"],
      }));

      expect(withSensitive.score).toBeGreaterThan(noSensitive.score);
    });

    it("detects policy violations", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        policyViolations: 3,
      }));

      expect(result.factors.some((f) => f.id === "policy_violation")).toBe(true);
    });

    it("detects excessive extension activity", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        extensionRequests: 100,
      }));

      expect(result.factors.some((f) => f.id === "extension_activity")).toBe(true);
    });

    it("ignores normal extension activity", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        extensionRequests: 10,
      }));

      expect(result.factors.some((f) => f.id === "extension_activity")).toBe(false);
    });
  });

  describe("severity levels", () => {
    it("assigns info severity for low score", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput());
      expect(result.severity).toBe("info");
    });

    it("assigns medium severity for moderate score", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
        hasLogin: true,
        hasPrivacyPolicy: false,
      }));

      expect(["medium", "high", "critical"]).toContain(result.severity);
    });

    it("assigns critical severity for high score", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isTyposquat: true,
        hasLogin: true,
        hasPrivacyPolicy: false,
        sessionCookies: 5,
        aiPromptsCount: 20,
        sensitiveDataTypes: ["credentials"],
      }));

      expect(result.severity).toBe("critical");
    });
  });

  describe("impact assessment", () => {
    it("includes data at risk for login", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        hasLogin: true,
      }));

      expect(result.impact.dataAtRisk).toContain("認証情報");
    });

    it("includes data at risk for PII", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        sensitiveDataTypes: ["pii"],
      }));

      expect(result.impact.dataAtRisk).toContain("個人情報");
    });

    it("includes data at risk for credentials", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        sensitiveDataTypes: ["credentials"],
      }));

      expect(result.impact.dataAtRisk).toContain("APIキー");
    });

    it("includes data at risk for financial", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        sensitiveDataTypes: ["financial"],
      }));

      expect(result.impact.dataAtRisk).toContain("金融情報");
    });

    it("assesses easy exploitability for typosquat", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isTyposquat: true,
      }));

      expect(result.impact.exploitability).toBe("easy");
    });

    it("assesses moderate exploitability for NRD", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
      }));

      expect(result.impact.exploitability).toBe("moderate");
    });

    it("assesses difficult exploitability for normal domain", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput());

      expect(result.impact.exploitability).toBe("difficult");
    });
  });

  describe("remediation", () => {
    it("suggests blocking for typosquat", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isTyposquat: true,
      }));

      expect(result.remediation.some((r) => r.type === "block_access")).toBe(true);
    });

    it("suggests investigation for NRD with login", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        isNRD: true,
        hasLogin: true,
      }));

      expect(result.remediation.some((r) => r.type === "investigate")).toBe(true);
    });

    it("suggests policy update for AI sensitive data", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        aiPromptsCount: 5,
        sensitiveDataTypes: ["credentials"],
      }));

      expect(result.remediation.some((r) => r.type === "update_policy")).toBe(true);
    });

    it("suggests monitoring for high severity", () => {
      const prioritizer = createRiskPrioritizer();
      // Create a scenario with critical severity (score >= 80)
      const result = prioritizer.analyzeRisk(createTestInput({
        isTyposquat: true,
        hasLogin: true,
        hasPrivacyPolicy: false,
        sessionCookies: 3,
      }));

      // Verify we have critical/high severity
      expect(["critical", "high"]).toContain(result.severity);
      expect(result.remediation.some((r) => r.type === "enable_monitoring")).toBe(true);
    });

    it("suggests accepting risk for low severity", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput());

      expect(result.remediation.some((r) => r.type === "accept_risk")).toBe(true);
    });
  });

  describe("prioritizeAll", () => {
    it("sorts by score descending", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = [
        createTestInput({ domain: "low.com" }),
        createTestInput({ domain: "high.com", isTyposquat: true }),
        createTestInput({ domain: "medium.com", isNRD: true }),
      ];

      const results = prioritizer.prioritizeAll(inputs);

      expect(results[0].domain).toBe("high.com");
      expect(results[results.length - 1].domain).toBe("low.com");
    });

    it("returns empty array for empty input", () => {
      const prioritizer = createRiskPrioritizer();
      const results = prioritizer.prioritizeAll([]);
      expect(results).toHaveLength(0);
    });
  });

  describe("getSummary", () => {
    it("returns zero counts for empty risks", () => {
      const prioritizer = createRiskPrioritizer();
      const summary = prioritizer.getSummary([]);

      expect(summary.totalRisks).toBe(0);
      expect(summary.criticalCount).toBe(0);
      expect(summary.averageScore).toBe(0);
    });

    it("counts risks by severity", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = [
        createTestInput({ domain: "critical.com", isTyposquat: true, hasLogin: true, sessionCookies: 5 }),
        createTestInput({ domain: "high.com", isNRD: true, hasLogin: true, hasPrivacyPolicy: false }),
        createTestInput({ domain: "low.com" }),
      ];

      const risks = prioritizer.prioritizeAll(inputs);
      const summary = prioritizer.getSummary(risks);

      expect(summary.totalRisks).toBe(3);
      expect(summary.criticalCount + summary.highCount + summary.mediumCount + summary.lowCount).toBeLessThanOrEqual(3);
    });

    it("calculates average score", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = [
        createTestInput({ domain: "a.com", isNRD: true }),
        createTestInput({ domain: "b.com", isTyposquat: true }),
      ];

      const risks = prioritizer.prioritizeAll(inputs);
      const summary = prioritizer.getSummary(risks);

      expect(summary.averageScore).toBeGreaterThan(0);
    });

    it("identifies top categories", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = [
        createTestInput({ domain: "a.com", isTyposquat: true }),
        createTestInput({ domain: "b.com", isTyposquat: true }),
        createTestInput({ domain: "c.com", isNRD: true }),
      ];

      const risks = prioritizer.prioritizeAll(inputs);
      const summary = prioritizer.getSummary(risks);

      expect(summary.topCategories.length).toBeGreaterThan(0);
    });

    it("calculates remediation progress", () => {
      const prioritizer = createRiskPrioritizer();
      const risks = prioritizer.prioritizeAll([
        createTestInput({ domain: "a.com", isNRD: true }),
      ]);

      // Mark some remediations as complete
      if (risks[0].remediation.length > 0) {
        risks[0].remediation[0].status = "completed";
      }

      const summary = prioritizer.getSummary(risks);
      expect(summary.remediationProgress).toBeGreaterThan(0);
    });
  });

  describe("getTopRisks", () => {
    it("returns top N risks", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = Array.from({ length: 20 }, (_, i) =>
        createTestInput({ domain: `domain${i}.com`, isNRD: i % 2 === 0 })
      );

      const risks = prioritizer.prioritizeAll(inputs);
      const top5 = prioritizer.getTopRisks(risks, 5);

      expect(top5.length).toBe(5);
    });

    it("returns all risks if less than limit", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = [
        createTestInput({ domain: "a.com" }),
        createTestInput({ domain: "b.com" }),
      ];

      const risks = prioritizer.prioritizeAll(inputs);
      const top10 = prioritizer.getTopRisks(risks, 10);

      expect(top10.length).toBe(2);
    });

    it("uses default limit of 10", () => {
      const prioritizer = createRiskPrioritizer();
      const inputs: RiskInput[] = Array.from({ length: 20 }, (_, i) =>
        createTestInput({ domain: `domain${i}.com` })
      );

      const risks = prioritizer.prioritizeAll(inputs);
      const top = prioritizer.getTopRisks(risks);

      expect(top.length).toBe(10);
    });
  });

  describe("result structure", () => {
    it("includes all required fields", () => {
      const prioritizer = createRiskPrioritizer();
      const result = prioritizer.analyzeRisk(createTestInput({
        domain: "test.com",
        isNRD: true,
      }));

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^risk_/);
      expect(result.title).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.severity).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.domain).toBe("test.com");
      expect(result.factors).toBeDefined();
      expect(result.impact).toBeDefined();
      expect(result.remediation).toBeDefined();
      expect(result.firstSeen).toBeDefined();
      expect(result.lastSeen).toBeDefined();
      expect(result.status).toBe("open");
    });
  });
});
