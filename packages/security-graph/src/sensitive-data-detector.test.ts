import { describe, it, expect } from "vitest";
import {
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
  type SensitiveDataResult,
} from "./sensitive-data-detector.js";

describe("detectSensitiveData", () => {
  describe("credentials detection", () => {
    it("detects API keys", () => {
      const text = "api_key: abcdefghijklmnopqrstuvwxyz123456";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.classification === "credentials")).toBe(true);
      expect(results.some((r) => r.pattern === "API Key")).toBe(true);
    });

    it("detects passwords", () => {
      const text = "password: mysecretpassword123";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Password")).toBe(true);
      expect(results[0].confidence).toBe("high");
    });

    it("detects OpenAI API keys", () => {
      const text = "sk-abcdefghijklmnopqrstuvwxyz1234567890";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "OpenAI API Key")).toBe(true);
    });

    it("detects Anthropic API keys", () => {
      const text = "sk-ant-" + "a".repeat(80);
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Anthropic API Key")).toBe(true);
    });

    it("detects GitHub tokens", () => {
      const text = "ghp_" + "a".repeat(36);
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "GitHub Token")).toBe(true);
    });

    it("detects GitHub OAuth tokens", () => {
      const text = "gho_" + "a".repeat(36);
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "GitHub OAuth Token")).toBe(true);
    });

    it("detects AWS Access Keys", () => {
      const text = "AKIAIOSFODNN7EXAMPLE";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "AWS Access Key")).toBe(true);
    });

    it("detects private keys", () => {
      const text = "-----BEGIN RSA PRIVATE KEY-----";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Private Key")).toBe(true);
    });
  });

  describe("PII detection", () => {
    it("detects email addresses", () => {
      const text = "Contact me at user@example.com";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Email Address")).toBe(true);
      expect(results.some((r) => r.classification === "pii")).toBe(true);
    });

    it("detects US phone numbers", () => {
      const text = "Call me at 555-123-4567";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "US Phone Number")).toBe(true);
    });

    it("detects Japanese phone numbers", () => {
      const text = "電話: 090-1234-5678";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "JP Phone Number")).toBe(true);
    });

    it("detects possible SSN", () => {
      const text = "SSN: 123-45-6789";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Possible SSN")).toBe(true);
      expect(results.find((r) => r.pattern === "Possible SSN")?.confidence).toBe("low");
    });

    it("detects physical addresses", () => {
      const text = "住所: 東京都渋谷区神宮前1-2-3マンション渋谷区";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Physical Address")).toBe(true);
    });
  });

  describe("financial detection", () => {
    it("detects credit card numbers (Visa)", () => {
      const text = "Card: 4111111111111111";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Credit Card Number")).toBe(true);
      expect(results.some((r) => r.classification === "financial")).toBe(true);
    });

    it("detects credit card numbers (Mastercard)", () => {
      const text = "Card: 5111111111111118";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Credit Card Number")).toBe(true);
    });

    it("detects card numbers with separators", () => {
      const text = "Card: 4111-1111-1111-1111";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Possible Card Number")).toBe(true);
    });

    it("detects bank account numbers", () => {
      const text = "口座番号: 1234567";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Bank Account")).toBe(true);
    });
  });

  describe("health detection", () => {
    it("detects medical records", () => {
      const text = "diagnosis: D-12345-ABC";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Medical Record")).toBe(true);
      expect(results.some((r) => r.classification === "health")).toBe(true);
    });

    it("detects insurance numbers", () => {
      const text = "保険証番号: ABC12345678";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Insurance Number")).toBe(true);
    });
  });

  describe("code detection", () => {
    it("detects source code", () => {
      const text = "function myFunction() {";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Source Code")).toBe(true);
      expect(results.some((r) => r.classification === "code")).toBe(true);
    });

    it("detects import statements", () => {
      const text = "import { useState } from 'react'";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Import Statement")).toBe(true);
    });

    it("detects SQL queries", () => {
      const text = "INSERT INTO users VALUES";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "SQL Query")).toBe(true);
    });
  });

  describe("internal detection", () => {
    it("detects confidential markers", () => {
      const text = "This is confidential information";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Confidential Marker")).toBe(true);
      expect(results.some((r) => r.classification === "internal")).toBe(true);
    });

    it("detects proprietary info markers", () => {
      const text = "This is proprietary data";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Proprietary Info")).toBe(true);
    });

    it("detects Japanese internal markers", () => {
      const text = "これは機密情報です";
      const results = detectSensitiveData(text);

      expect(results.some((r) => r.pattern === "Confidential Marker")).toBe(true);
    });
  });

  describe("result properties", () => {
    it("includes position in results", () => {
      const text = "prefix api_key: abcdefghijklmnopqrstuvwxyz123456";
      const results = detectSensitiveData(text);

      expect(results[0].position).toBeGreaterThan(0);
    });

    it("masks sensitive text", () => {
      const text = "api_key: abcdefghijklmnopqrstuvwxyz123456";
      const results = detectSensitiveData(text);

      expect(results[0].matchedText).toContain("*");
      expect(results[0].matchedText).not.toBe("api_key: abcdefghijklmnopqrstuvwxyz123456");
    });
  });

  describe("multiple detections", () => {
    it("detects multiple sensitive data in same text", () => {
      const text = `
        Email: user@example.com
        Password: secretpass123
        API Key: api_key=abcdefghijklmnopqrstuvwxyz123456
      `;
      const results = detectSensitiveData(text);

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results.some((r) => r.classification === "pii")).toBe(true);
      expect(results.some((r) => r.classification === "credentials")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for safe text", () => {
      const text = "Hello, this is a normal message.";
      const results = detectSensitiveData(text);

      expect(results.length).toBe(0);
    });

    it("handles empty string", () => {
      const results = detectSensitiveData("");

      expect(results).toEqual([]);
    });
  });
});

describe("hasSensitiveData", () => {
  it("returns true for text with sensitive data", () => {
    expect(hasSensitiveData("api_key: abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
  });

  it("returns false for safe text", () => {
    expect(hasSensitiveData("Hello world")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasSensitiveData("")).toBe(false);
  });

  it("returns true for email", () => {
    expect(hasSensitiveData("Contact: user@example.com")).toBe(true);
  });

  it("returns true for credit card", () => {
    expect(hasSensitiveData("Card: 4111111111111111")).toBe(true);
  });
});

describe("getHighestRiskClassification", () => {
  it("returns null for empty results", () => {
    expect(getHighestRiskClassification([])).toBeNull();
  });

  it("returns credentials as highest priority", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "code", confidence: "low", pattern: "Source Code" },
    ];

    expect(getHighestRiskClassification(results)).toBe("credentials");
  });

  it("returns financial over pii", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "financial", confidence: "high", pattern: "Credit Card" },
    ];

    expect(getHighestRiskClassification(results)).toBe("financial");
  });

  it("returns health over pii", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "health", confidence: "medium", pattern: "Medical" },
    ];

    expect(getHighestRiskClassification(results)).toBe("health");
  });

  it("returns pii over internal", () => {
    const results: SensitiveDataResult[] = [
      { classification: "internal", confidence: "medium", pattern: "Confidential" },
      { classification: "pii", confidence: "medium", pattern: "Email" },
    ];

    expect(getHighestRiskClassification(results)).toBe("pii");
  });

  it("returns internal over code", () => {
    const results: SensitiveDataResult[] = [
      { classification: "code", confidence: "low", pattern: "Source Code" },
      { classification: "internal", confidence: "medium", pattern: "Confidential" },
    ];

    expect(getHighestRiskClassification(results)).toBe("internal");
  });

  it("returns single classification", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
    ];

    expect(getHighestRiskClassification(results)).toBe("pii");
  });
});

describe("getSensitiveDataSummary", () => {
  it("returns zero counts for empty results", () => {
    const summary = getSensitiveDataSummary([]);

    expect(summary.credentials).toBe(0);
    expect(summary.pii).toBe(0);
    expect(summary.financial).toBe(0);
    expect(summary.health).toBe(0);
    expect(summary.code).toBe(0);
    expect(summary.internal).toBe(0);
    expect(summary.unknown).toBe(0);
  });

  it("counts classifications correctly", () => {
    const results: SensitiveDataResult[] = [
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "pii", confidence: "medium", pattern: "Phone" },
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "code", confidence: "low", pattern: "Source Code" },
    ];

    const summary = getSensitiveDataSummary(results);

    expect(summary.pii).toBe(2);
    expect(summary.credentials).toBe(1);
    expect(summary.code).toBe(1);
    expect(summary.financial).toBe(0);
  });

  it("handles all classification types", () => {
    const results: SensitiveDataResult[] = [
      { classification: "credentials", confidence: "high", pattern: "API Key" },
      { classification: "pii", confidence: "medium", pattern: "Email" },
      { classification: "financial", confidence: "high", pattern: "Card" },
      { classification: "health", confidence: "medium", pattern: "Medical" },
      { classification: "code", confidence: "low", pattern: "Code" },
      { classification: "internal", confidence: "medium", pattern: "Confidential" },
    ];

    const summary = getSensitiveDataSummary(results);

    expect(summary.credentials).toBe(1);
    expect(summary.pii).toBe(1);
    expect(summary.financial).toBe(1);
    expect(summary.health).toBe(1);
    expect(summary.code).toBe(1);
    expect(summary.internal).toBe(1);
  });
});

describe("integration tests", () => {
  it("detects and summarizes AI prompt with sensitive data", () => {
    const prompt = `
      Please help me with this code:

      const API_KEY = "sk-abcdefghijklmnopqrstuvwxyz1234567890";
      const userEmail = "john.doe@company.com";

      function processPayment() {
        const card = "4111-1111-1111-1111";
        // This is confidential business logic
      }
    `;

    const results = detectSensitiveData(prompt);
    const summary = getSensitiveDataSummary(results);
    const highestRisk = getHighestRiskClassification(results);

    expect(results.length).toBeGreaterThan(0);
    expect(summary.credentials).toBeGreaterThan(0);
    expect(summary.pii).toBeGreaterThan(0);
    expect(summary.financial).toBeGreaterThan(0);
    expect(highestRisk).toBe("credentials");
  });

  it("handles safe AI prompt", () => {
    const prompt = `
      How do I implement a binary search algorithm in JavaScript?
      Please provide an example with comments.
    `;

    const results = detectSensitiveData(prompt);

    expect(results.length).toBe(0);
    expect(hasSensitiveData(prompt)).toBe(false);
  });
});
