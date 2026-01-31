import { describe, it, expect } from "vitest";
import {
  computeTrustScore,
  createTrustAlgorithm,
  DEFAULT_TRUST_INPUT,
  type TrustInput,
} from "./trust-algorithm.js";

describe("computeTrustScore", () => {
  describe("baseline score", () => {
    it("returns trusted level for clean input", () => {
      const result = computeTrustScore(DEFAULT_TRUST_INPUT);
      expect(result.score).toBe(100);
      expect(result.level).toBe("trusted");
      expect(result.factors).toHaveLength(0);
    });

    it("returns trusted level with authentication bonus", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        isAuthenticated: true,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(100); // Capped at 100
      expect(result.level).toBe("trusted");
    });

    it("returns trusted level with enterprise device bonus", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        isEnterpriseManagedDevice: true,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(100); // Capped at 100
      expect(result.level).toBe("trusted");
    });
  });

  describe("NRD detection", () => {
    it("deducts score for high confidence NRD", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        isNRD: true,
        nrdConfidence: "high",
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(70);
      expect(result.level).toBe("conditional");
    });

    it("deducts less for low confidence NRD", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        isNRD: true,
        nrdConfidence: "low",
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(88);
      expect(result.level).toBe("trusted");
    });
  });

  describe("typosquat detection", () => {
    it("deducts heavily for high confidence typosquat", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        typosquatConfidence: "high",
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(60);
      expect(result.level).toBe("conditional");
    });

    it("no deduction for none confidence", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        typosquatConfidence: "none",
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(100);
    });
  });

  describe("CSP violations", () => {
    it("deducts for single violation", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        cspViolationCount: 1,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(95);
    });

    it("caps deduction at 25", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        cspViolationCount: 10,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(75);
    });
  });

  describe("extension risk", () => {
    it("deducts based on risk score", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        extensionRiskScore: 20,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(90);
    });

    it("caps deduction at 20", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        extensionRiskScore: 100,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(80);
    });
  });

  describe("suspicious patterns", () => {
    it("deducts for patterns", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        suspiciousPatternCount: 2,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(80);
    });

    it("caps deduction at 30", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        suspiciousPatternCount: 5,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(70);
    });
  });

  describe("DoH detection", () => {
    it("deducts for DoH usage", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        dohDetected: true,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(85);
    });
  });

  describe("policy violations", () => {
    it("deducts for violations", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        policyViolations: 2,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(70);
    });

    it("caps deduction at 45", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        policyViolations: 5,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(55);
    });
  });

  describe("combined factors", () => {
    it("returns untrusted for multiple negative factors", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        isNRD: true,
        nrdConfidence: "high",
        typosquatConfidence: "medium",
        cspViolationCount: 3,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBeLessThan(50);
      expect(result.level).toBe("untrusted");
    });

    it("positive factors can offset negative", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        cspViolationCount: 2,
        isAuthenticated: true,
        isEnterpriseManagedDevice: true,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(100); // 100 - 10 + 10 + 15, capped at 100
    });

    it("clamps score to 0", () => {
      const input: TrustInput = {
        isNRD: true,
        nrdConfidence: "high",
        typosquatConfidence: "high",
        cspViolationCount: 10,
        extensionRiskScore: 100,
        suspiciousPatternCount: 5,
        dohDetected: true,
        policyViolations: 5,
        isAuthenticated: false,
        isEnterpriseManagedDevice: false,
      };
      const result = computeTrustScore(input);
      expect(result.score).toBe(0);
      expect(result.level).toBe("untrusted");
    });
  });

  describe("factors tracking", () => {
    it("records all contributing factors", () => {
      const input: TrustInput = {
        ...DEFAULT_TRUST_INPUT,
        isNRD: true,
        nrdConfidence: "medium",
        cspViolationCount: 1,
        isAuthenticated: true,
      };
      const result = computeTrustScore(input);
      expect(result.factors).toHaveLength(3);
      expect(result.factors.map((f) => f.name)).toContain("NRD");
      expect(result.factors.map((f) => f.name)).toContain("CSP Violations");
      expect(result.factors.map((f) => f.name)).toContain("Authenticated");
    });
  });
});

describe("createTrustAlgorithm", () => {
  it("creates algorithm with default thresholds", () => {
    const algorithm = createTrustAlgorithm();
    expect(algorithm.getThresholds()).toEqual({ trusted: 80, conditional: 50 });
  });

  it("applies custom thresholds", () => {
    const algorithm = createTrustAlgorithm({
      thresholds: { trusted: 90, conditional: 60 },
    });

    const result = algorithm.compute({
      ...DEFAULT_TRUST_INPUT,
      cspViolationCount: 3, // Score will be 85
    });

    expect(result.score).toBe(85);
    expect(result.level).toBe("conditional"); // Would be trusted with default thresholds
  });

  it("computes same score as standalone function", () => {
    const algorithm = createTrustAlgorithm();
    const input: TrustInput = {
      ...DEFAULT_TRUST_INPUT,
      isNRD: true,
      nrdConfidence: "high",
    };

    const algorithmResult = algorithm.compute(input);
    const standaloneResult = computeTrustScore(input);

    expect(algorithmResult.score).toBe(standaloneResult.score);
    expect(algorithmResult.factors).toEqual(standaloneResult.factors);
  });
});
