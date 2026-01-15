import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  scoreToRiskLevel,
  riskLevelPriority,
  getRiskColor,
  type RiskFactors,
} from "./risk-calculator.js";

describe("calculateRiskScore", () => {
  describe("NRD risk", () => {
    it("returns 0 for no risk factors", () => {
      expect(calculateRiskScore({})).toBe(0);
    });

    it("calculates high NRD risk", () => {
      const score = calculateRiskScore({
        isNRD: true,
        nrdConfidence: "high",
      });
      expect(score).toBe(35);
    });

    it("calculates medium NRD risk", () => {
      const score = calculateRiskScore({
        isNRD: true,
        nrdConfidence: "medium",
      });
      expect(score).toBe(25);
    });

    it("calculates low NRD risk", () => {
      const score = calculateRiskScore({
        isNRD: true,
        nrdConfidence: "low",
      });
      expect(score).toBe(15);
    });

    it("calculates unknown NRD risk", () => {
      const score = calculateRiskScore({
        isNRD: true,
        nrdConfidence: "unknown",
      });
      expect(score).toBe(10);
    });

    it("ignores NRD without confidence", () => {
      const score = calculateRiskScore({
        isNRD: true,
      });
      expect(score).toBe(0);
    });
  });

  describe("typosquat risk", () => {
    it("calculates high typosquat risk", () => {
      const score = calculateRiskScore({
        isTyposquat: true,
        typosquatConfidence: "high",
      });
      expect(score).toBe(40);
    });

    it("calculates medium typosquat risk", () => {
      const score = calculateRiskScore({
        isTyposquat: true,
        typosquatConfidence: "medium",
      });
      expect(score).toBe(30);
    });

    it("calculates low typosquat risk", () => {
      const score = calculateRiskScore({
        isTyposquat: true,
        typosquatConfidence: "low",
      });
      expect(score).toBe(20);
    });

    it("ignores none confidence", () => {
      const score = calculateRiskScore({
        isTyposquat: true,
        typosquatConfidence: "none",
      });
      expect(score).toBe(0);
    });
  });

  describe("DDNS risk", () => {
    it("adds DDNS risk", () => {
      const score = calculateRiskScore({
        isDDNS: true,
      });
      expect(score).toBe(20);
    });
  });

  describe("policy risks", () => {
    it("adds risk for login without privacy policy", () => {
      const score = calculateRiskScore({
        hasLogin: true,
        hasPrivacyPolicy: false,
        hasTermsOfService: true, // explicitly set to avoid ToS penalty
      });
      expect(score).toBe(15);
    });

    it("adds risk for login without terms of service", () => {
      const score = calculateRiskScore({
        hasLogin: true,
        hasPrivacyPolicy: true,
        hasTermsOfService: false,
      });
      expect(score).toBe(5);
    });

    it("adds combined risk for login without both", () => {
      const score = calculateRiskScore({
        hasLogin: true,
        hasPrivacyPolicy: false,
        hasTermsOfService: false,
      });
      expect(score).toBe(20); // 15 + 5
    });

    it("no policy risk without login", () => {
      const score = calculateRiskScore({
        hasLogin: false,
        hasPrivacyPolicy: false,
        hasTermsOfService: false,
      });
      expect(score).toBe(0);
    });
  });

  describe("data type risks", () => {
    it("adds risk for credentials", () => {
      const score = calculateRiskScore({
        dataTypes: ["credentials"],
      });
      expect(score).toBe(30);
    });

    it("adds risk for financial data", () => {
      const score = calculateRiskScore({
        dataTypes: ["financial"],
      });
      expect(score).toBe(30);
    });

    it("adds risk for PII", () => {
      const score = calculateRiskScore({
        dataTypes: ["pii"],
      });
      expect(score).toBe(25);
    });

    it("adds risk for health data", () => {
      const score = calculateRiskScore({
        dataTypes: ["health"],
      });
      expect(score).toBe(25);
    });

    it("adds risk for internal data", () => {
      const score = calculateRiskScore({
        dataTypes: ["internal"],
      });
      expect(score).toBe(20);
    });

    it("adds risk for code", () => {
      const score = calculateRiskScore({
        dataTypes: ["code"],
      });
      expect(score).toBe(15);
    });

    it("uses highest risk for multiple data types", () => {
      const score = calculateRiskScore({
        dataTypes: ["code", "credentials", "pii"],
      });
      // Should use credentials (30) as highest
      expect(score).toBe(30);
    });

    it("ignores empty data types array", () => {
      const score = calculateRiskScore({
        dataTypes: [],
      });
      expect(score).toBe(0);
    });
  });

  describe("CSP violation risks", () => {
    it("adds risk for CSP violations", () => {
      const score = calculateRiskScore({
        cspViolationCount: 5,
      });
      expect(score).toBe(10); // 5 * 2
    });

    it("caps CSP risk at max", () => {
      const score = calculateRiskScore({
        cspViolationCount: 100,
      });
      expect(score).toBe(20); // max is 20
    });

    it("ignores zero violations", () => {
      const score = calculateRiskScore({
        cspViolationCount: 0,
      });
      expect(score).toBe(0);
    });
  });

  describe("extension risks", () => {
    it("adds risk for excessive extension requests", () => {
      const score = calculateRiskScore({
        extensionRequestCount: 15,
      });
      expect(score).toBe(15);
    });

    it("ignores requests at or below threshold", () => {
      const score = calculateRiskScore({
        extensionRequestCount: 10,
      });
      expect(score).toBe(0);
    });

    it("ignores zero requests", () => {
      const score = calculateRiskScore({
        extensionRequestCount: 0,
      });
      expect(score).toBe(0);
    });
  });

  describe("AI risks", () => {
    it("adds base risk for AI prompts", () => {
      const score = calculateRiskScore({
        aiPromptCount: 5,
        aiHasSensitiveData: false,
      });
      expect(score).toBe(5);
    });

    it("adds higher risk for AI with sensitive data", () => {
      const score = calculateRiskScore({
        aiPromptCount: 5,
        aiHasSensitiveData: true,
      });
      expect(score).toBe(25);
    });

    it("ignores zero prompts", () => {
      const score = calculateRiskScore({
        aiPromptCount: 0,
        aiHasSensitiveData: true,
      });
      expect(score).toBe(0);
    });
  });

  describe("combined risks", () => {
    it("calculates combined risk", () => {
      const score = calculateRiskScore({
        isNRD: true,
        nrdConfidence: "high", // 35
        hasLogin: true,
        hasPrivacyPolicy: false, // 15
        hasTermsOfService: true, // avoid ToS penalty
        cspViolationCount: 5, // 10
      });
      expect(score).toBe(60); // 35 + 15 + 10
    });

    it("caps at 100", () => {
      const score = calculateRiskScore({
        isNRD: true,
        nrdConfidence: "high", // 35
        isTyposquat: true,
        typosquatConfidence: "high", // 40
        dataTypes: ["credentials"], // 30
        aiPromptCount: 5,
        aiHasSensitiveData: true, // 25
      });
      expect(score).toBe(100);
    });
  });
});

describe("scoreToRiskLevel", () => {
  it("returns critical for score >= 80", () => {
    expect(scoreToRiskLevel(80)).toBe("critical");
    expect(scoreToRiskLevel(100)).toBe("critical");
  });

  it("returns high for score 60-79", () => {
    expect(scoreToRiskLevel(60)).toBe("high");
    expect(scoreToRiskLevel(79)).toBe("high");
  });

  it("returns medium for score 40-59", () => {
    expect(scoreToRiskLevel(40)).toBe("medium");
    expect(scoreToRiskLevel(59)).toBe("medium");
  });

  it("returns low for score 20-39", () => {
    expect(scoreToRiskLevel(20)).toBe("low");
    expect(scoreToRiskLevel(39)).toBe("low");
  });

  it("returns info for score < 20", () => {
    expect(scoreToRiskLevel(0)).toBe("info");
    expect(scoreToRiskLevel(19)).toBe("info");
  });
});

describe("riskLevelPriority", () => {
  it("returns correct priorities", () => {
    expect(riskLevelPriority("critical")).toBe(5);
    expect(riskLevelPriority("high")).toBe(4);
    expect(riskLevelPriority("medium")).toBe(3);
    expect(riskLevelPriority("low")).toBe(2);
    expect(riskLevelPriority("info")).toBe(1);
  });

  it("can be used for sorting", () => {
    const levels: Array<"critical" | "high" | "medium" | "low" | "info"> = [
      "low",
      "critical",
      "medium",
      "info",
      "high",
    ];
    const sorted = levels.sort((a, b) => riskLevelPriority(b) - riskLevelPriority(a));
    expect(sorted).toEqual(["critical", "high", "medium", "low", "info"]);
  });
});

describe("getRiskColor", () => {
  it("returns red for critical", () => {
    expect(getRiskColor("critical")).toBe("#dc2626");
  });

  it("returns orange for high", () => {
    expect(getRiskColor("high")).toBe("#ea580c");
  });

  it("returns yellow for medium", () => {
    expect(getRiskColor("medium")).toBe("#ca8a04");
  });

  it("returns green for low", () => {
    expect(getRiskColor("low")).toBe("#16a34a");
  });

  it("returns gray for info", () => {
    expect(getRiskColor("info")).toBe("#6b7280");
  });
});
