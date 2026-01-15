import { describe, it, expect } from "vitest";
import {
  HIGH_RISK_TLDS,
  FINANCIAL_TLDS,
  PHISHING_PATTERNS,
  IMPERSONATION_INDICATORS,
  INFRASTRUCTURE_PATTERNS,
  getThreatDataVersion,
  type ThreatIndicator,
} from "./threat-data.js";

describe("HIGH_RISK_TLDS", () => {
  it("contains known high-risk TLDs", () => {
    expect(HIGH_RISK_TLDS.has("tk")).toBe(true);
    expect(HIGH_RISK_TLDS.has("ml")).toBe(true);
    expect(HIGH_RISK_TLDS.has("ga")).toBe(true);
    expect(HIGH_RISK_TLDS.has("cf")).toBe(true);
    expect(HIGH_RISK_TLDS.has("gq")).toBe(true);
  });

  it("contains commonly abused TLDs", () => {
    expect(HIGH_RISK_TLDS.has("xyz")).toBe(true);
    expect(HIGH_RISK_TLDS.has("top")).toBe(true);
    expect(HIGH_RISK_TLDS.has("click")).toBe(true);
    expect(HIGH_RISK_TLDS.has("link")).toBe(true);
    expect(HIGH_RISK_TLDS.has("online")).toBe(true);
  });

  it("does not contain safe TLDs", () => {
    expect(HIGH_RISK_TLDS.has("com")).toBe(false);
    expect(HIGH_RISK_TLDS.has("org")).toBe(false);
    expect(HIGH_RISK_TLDS.has("net")).toBe(false);
    expect(HIGH_RISK_TLDS.has("edu")).toBe(false);
    expect(HIGH_RISK_TLDS.has("gov")).toBe(false);
  });

  it("is a ReadonlySet", () => {
    expect(HIGH_RISK_TLDS).toBeInstanceOf(Set);
    expect(HIGH_RISK_TLDS.size).toBeGreaterThan(0);
  });
});

describe("FINANCIAL_TLDS", () => {
  it("contains financial TLDs", () => {
    expect(FINANCIAL_TLDS.has("bank")).toBe(true);
    expect(FINANCIAL_TLDS.has("insurance")).toBe(true);
    expect(FINANCIAL_TLDS.has("finance")).toBe(true);
  });

  it("does not contain non-financial TLDs", () => {
    expect(FINANCIAL_TLDS.has("com")).toBe(false);
    expect(FINANCIAL_TLDS.has("xyz")).toBe(false);
  });
});

describe("PHISHING_PATTERNS", () => {
  it("has login verification patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Login verification")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("secure-account")).toBe(true);
    expect(pattern?.pattern.test("verify-login")).toBe(true);
  });

  it("has account security patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Account security")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("account-secure")).toBe(true);
    expect(pattern?.pattern.test("login-verify")).toBe(true);
  });

  it("has urgency indicator patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Urgency")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("urgent-action")).toBe(true);
    expect(pattern?.pattern.test("account-suspended")).toBe(true);
    expect(pattern?.pattern.test("account-locked")).toBe(true);
  });

  it("has fake support patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Fake support")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("support-center")).toBe(true);
    expect(pattern?.pattern.test("helpdesk-service")).toBe(true);
  });

  it("has numeric suffix patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Numeric suffix")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("domain12345")).toBe(true);
    expect(pattern?.pattern.test("domain123")).toBe(false); // less than 4 digits
  });

  it("has multiple hyphens patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Multiple hyphens")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("example--test")).toBe(true);
    expect(pattern?.pattern.test("example-test")).toBe(false);
  });

  it("has long subdomain patterns", () => {
    const pattern = PHISHING_PATTERNS.find((p) =>
      p.description.includes("Very long subdomain")
    );
    expect(pattern).toBeDefined();
    const longSubdomain = "a".repeat(35) + ".example.com";
    expect(pattern?.pattern.test(longSubdomain)).toBe(true);
    expect(pattern?.pattern.test("short.example.com")).toBe(false);
  });

  it("all patterns have required fields", () => {
    for (const pattern of PHISHING_PATTERNS) {
      expect(pattern.pattern).toBeInstanceOf(RegExp);
      expect(pattern.description).toBeDefined();
      expect(typeof pattern.description).toBe("string");
      expect(pattern.score).toBeGreaterThan(0);
      expect(pattern.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("IMPERSONATION_INDICATORS", () => {
  it("has authenticity claim patterns", () => {
    const pattern = IMPERSONATION_INDICATORS.find((p) =>
      p.description.includes("Authenticity claim")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("official-site.com")).toBe(true);
    expect(pattern?.pattern.test("real-bank.com")).toBe(true);
    expect(pattern?.pattern.test("genuine-service.com")).toBe(true);
  });

  it("has possessive account patterns", () => {
    const pattern = IMPERSONATION_INDICATORS.find((p) =>
      p.description.includes("Possessive account")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("my-account.com")).toBe(true);
    expect(pattern?.pattern.test("your-portal.com")).toBe(true);
  });

  it("has security claim patterns", () => {
    const pattern = IMPERSONATION_INDICATORS.find((p) =>
      p.description.includes("Security claim")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("ssl-secure.com")).toBe(true);
    expect(pattern?.pattern.test("https-protected.com")).toBe(true);
  });

  it("has region-specific patterns", () => {
    const pattern = IMPERSONATION_INDICATORS.find((p) =>
      p.description.includes("Region-specific")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("jp-login.com")).toBe(true);
    expect(pattern?.pattern.test("us-portal.com")).toBe(true);
  });

  it("all patterns have required fields", () => {
    for (const pattern of IMPERSONATION_INDICATORS) {
      expect(pattern.pattern).toBeInstanceOf(RegExp);
      expect(pattern.description).toBeDefined();
      expect(pattern.score).toBeGreaterThan(0);
    }
  });
});

describe("INFRASTRUCTURE_PATTERNS", () => {
  it("has random alphanumeric subdomain patterns", () => {
    const pattern = INFRASTRUCTURE_PATTERNS.find((p) =>
      p.description.includes("Random alphanumeric")
    );
    expect(pattern).toBeDefined();
    const randomSubdomain = "abc123def456ghi789.example.com";
    expect(pattern?.pattern.test(randomSubdomain)).toBe(true);
    expect(pattern?.pattern.test("short.example.com")).toBe(false);
  });

  it("has IP-like patterns", () => {
    const pattern = INFRASTRUCTURE_PATTERNS.find((p) =>
      p.description.includes("IP-like")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("192-168-1-1.example.com")).toBe(true);
    expect(pattern?.pattern.test("192.168.1.example.com")).toBe(true);
  });

  it("has Base64-like patterns", () => {
    const pattern = INFRASTRUCTURE_PATTERNS.find((p) =>
      p.description.includes("Base64-like")
    );
    expect(pattern).toBeDefined();
    expect(pattern?.pattern.test("YWJjZGVmZ2hpamtsbW5vcHFyc3Q=")).toBe(true);
  });

  it("has UUID patterns", () => {
    const pattern = INFRASTRUCTURE_PATTERNS.find((p) =>
      p.description.includes("UUID")
    );
    expect(pattern).toBeDefined();
    expect(
      pattern?.pattern.test("550e8400-e29b-41d4-a716-446655440000")
    ).toBe(true);
  });

  it("all patterns have required fields", () => {
    for (const pattern of INFRASTRUCTURE_PATTERNS) {
      expect(pattern.pattern).toBeInstanceOf(RegExp);
      expect(pattern.description).toBeDefined();
      expect(pattern.score).toBeGreaterThan(0);
    }
  });
});

describe("getThreatDataVersion", () => {
  it("returns version info", () => {
    const version = getThreatDataVersion();

    expect(version.version).toBeDefined();
    expect(version.lastUpdated).toBeDefined();
    expect(version.totalPatterns).toBeGreaterThan(0);
  });

  it("calculates total patterns correctly", () => {
    const version = getThreatDataVersion();
    const expectedTotal =
      PHISHING_PATTERNS.length +
      IMPERSONATION_INDICATORS.length +
      INFRASTRUCTURE_PATTERNS.length;

    expect(version.totalPatterns).toBe(expectedTotal);
  });

  it("returns consistent version", () => {
    const version1 = getThreatDataVersion();
    const version2 = getThreatDataVersion();

    expect(version1.version).toBe(version2.version);
    expect(version1.totalPatterns).toBe(version2.totalPatterns);
  });
});

describe("Pattern scoring", () => {
  it("login patterns have high scores", () => {
    const loginPatterns = PHISHING_PATTERNS.filter(
      (p) =>
        p.description.includes("Login") || p.description.includes("Account")
    );

    for (const pattern of loginPatterns) {
      expect(pattern.score).toBeGreaterThanOrEqual(20);
    }
  });

  it("authenticity claim patterns have high scores", () => {
    const authenticityPattern = IMPERSONATION_INDICATORS.find((p) =>
      p.description.includes("Authenticity")
    );

    expect(authenticityPattern?.score).toBeGreaterThanOrEqual(30);
  });

  it("UUID patterns have high scores", () => {
    const uuidPattern = INFRASTRUCTURE_PATTERNS.find((p) =>
      p.description.includes("UUID")
    );

    expect(uuidPattern?.score).toBeGreaterThanOrEqual(30);
  });
});

describe("Pattern uniqueness", () => {
  it("phishing patterns have unique descriptions", () => {
    const descriptions = PHISHING_PATTERNS.map((p) => p.description);
    const uniqueDescriptions = new Set(descriptions);
    expect(uniqueDescriptions.size).toBe(descriptions.length);
  });

  it("impersonation patterns have unique descriptions", () => {
    const descriptions = IMPERSONATION_INDICATORS.map((p) => p.description);
    const uniqueDescriptions = new Set(descriptions);
    expect(uniqueDescriptions.size).toBe(descriptions.length);
  });

  it("infrastructure patterns have unique descriptions", () => {
    const descriptions = INFRASTRUCTURE_PATTERNS.map((p) => p.description);
    const uniqueDescriptions = new Set(descriptions);
    expect(uniqueDescriptions.size).toBe(descriptions.length);
  });
});

describe("TLD data integrity", () => {
  it("HIGH_RISK_TLDS and FINANCIAL_TLDS are disjoint", () => {
    for (const tld of FINANCIAL_TLDS) {
      expect(HIGH_RISK_TLDS.has(tld)).toBe(false);
    }
  });

  it("all TLDs are lowercase", () => {
    for (const tld of HIGH_RISK_TLDS) {
      expect(tld).toBe(tld.toLowerCase());
    }
    for (const tld of FINANCIAL_TLDS) {
      expect(tld).toBe(tld.toLowerCase());
    }
  });

  it("all TLDs are non-empty strings", () => {
    for (const tld of HIGH_RISK_TLDS) {
      expect(tld.length).toBeGreaterThan(0);
    }
    for (const tld of FINANCIAL_TLDS) {
      expect(tld.length).toBeGreaterThan(0);
    }
  });
});
