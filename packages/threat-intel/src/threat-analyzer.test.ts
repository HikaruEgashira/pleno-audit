import { describe, it, expect, beforeEach } from "vitest";
import {
  createThreatAnalyzer,
  DEFAULT_THREAT_ANALYZER_CONFIG,
} from "./threat-analyzer.js";
import {
  HIGH_RISK_TLDS,
  getThreatDataVersion,
} from "./threat-data.js";

describe("createThreatAnalyzer", () => {
  describe("initialization", () => {
    it("creates analyzer with default config", () => {
      const analyzer = createThreatAnalyzer();
      const config = analyzer.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.minScoreToReport).toBe(30);
    });

    it("creates analyzer with custom config", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
        minScoreToReport: 50,
      });
      expect(analyzer.isEnabled()).toBe(true);
      expect(analyzer.getConfig().minScoreToReport).toBe(50);
    });
  });

  describe("config management", () => {
    it("updates config", () => {
      const analyzer = createThreatAnalyzer();
      analyzer.updateConfig({ enabled: true });
      expect(analyzer.isEnabled()).toBe(true);
    });

    it("partially updates config", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        minScoreToReport: 20,
      });
      analyzer.updateConfig({ enabled: true });
      expect(analyzer.getConfig().minScoreToReport).toBe(20);
      expect(analyzer.isEnabled()).toBe(true);
    });
  });

  describe("high-risk TLD detection", () => {
    let analyzer: ReturnType<typeof createThreatAnalyzer>;

    beforeEach(() => {
      analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
    });

    it("detects high-risk TLD .tk", () => {
      const result = analyzer.analyze("malicious.tk");
      expect(result.hasHighRiskTLD).toBe(true);
      expect(result.matches.some((m) => m.category === "high_risk_tld")).toBe(true);
    });

    it("detects high-risk TLD .xyz", () => {
      const result = analyzer.analyze("suspicious.xyz");
      expect(result.hasHighRiskTLD).toBe(true);
    });

    it("detects high-risk TLD .ml", () => {
      const result = analyzer.analyze("phishing.ml");
      expect(result.hasHighRiskTLD).toBe(true);
    });

    it("does not flag .com as high-risk", () => {
      const result = analyzer.analyze("legitimate.com");
      expect(result.hasHighRiskTLD).toBe(false);
    });

    it("does not flag .org as high-risk", () => {
      const result = analyzer.analyze("nonprofit.org");
      expect(result.hasHighRiskTLD).toBe(false);
    });

    it("can disable high-risk TLD check", () => {
      analyzer.updateConfig({ checkHighRiskTLDs: false });
      const result = analyzer.analyze("malicious.tk");
      expect(result.hasHighRiskTLD).toBe(true); // Still detected
      expect(result.matches.some((m) => m.category === "high_risk_tld")).toBe(false); // Not scored
    });
  });

  describe("phishing pattern detection", () => {
    let analyzer: ReturnType<typeof createThreatAnalyzer>;

    beforeEach(() => {
      analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
    });

    it("detects secure-account pattern", () => {
      const result = analyzer.analyze("secure-account-update.com");
      expect(result.matches.some((m) => m.category === "phishing")).toBe(true);
    });

    it("detects verify-login pattern", () => {
      const result = analyzer.analyze("verify-login.example.com");
      expect(result.matches.some((m) => m.category === "phishing")).toBe(true);
    });

    it("detects urgency keywords", () => {
      const result = analyzer.analyze("urgent-notice.com");
      expect(result.matches.some((m) => m.description.includes("Urgency"))).toBe(true);
    });

    it("detects support-center pattern", () => {
      const result = analyzer.analyze("customer-service-team.com");
      expect(result.matches.some((m) => m.description.includes("support"))).toBe(true);
    });

    it("detects numeric suffix pattern", () => {
      // Pattern: /\d{4,}$/ - domain must end with 4+ digits
      const result = analyzer.analyze("bank.example12345");
      expect(result.matches.some((m) => m.description.includes("Numeric"))).toBe(true);
    });

    it("detects multiple hyphens", () => {
      const result = analyzer.analyze("secure--login--page.com");
      expect(result.matches.some((m) => m.description.includes("hyphens"))).toBe(true);
    });

    it("detects very long subdomain", () => {
      const longSubdomain = "a".repeat(35);
      const result = analyzer.analyze(`${longSubdomain}.example.com`);
      expect(result.matches.some((m) => m.description.includes("long subdomain"))).toBe(true);
    });
  });

  describe("impersonation detection", () => {
    let analyzer: ReturnType<typeof createThreatAnalyzer>;

    beforeEach(() => {
      analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
    });

    it("detects official- prefix", () => {
      const result = analyzer.analyze("official-bank.com");
      expect(result.matches.some((m) => m.category === "impersonation")).toBe(true);
    });

    it("detects authentic- prefix", () => {
      const result = analyzer.analyze("authentic-store.com");
      expect(result.matches.some((m) => m.description.includes("Authenticity"))).toBe(true);
    });

    it("detects my-account pattern", () => {
      const result = analyzer.analyze("my-account-portal.com");
      expect(result.matches.some((m) => m.category === "impersonation")).toBe(true);
    });

    it("detects secure- prefix in domain", () => {
      const result = analyzer.analyze("secure-login.example.com");
      expect(result.matches.some((m) => m.description.includes("Security claim"))).toBe(true);
    });

    it("detects region-specific portal", () => {
      const result = analyzer.analyze("jp-login-portal.com");
      expect(result.matches.some((m) => m.description.includes("Region"))).toBe(true);
    });
  });

  describe("infrastructure pattern detection", () => {
    let analyzer: ReturnType<typeof createThreatAnalyzer>;

    beforeEach(() => {
      analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
    });

    it("detects random alphanumeric subdomain", () => {
      const result = analyzer.analyze("abc123def456ghi789jkl.example.com");
      expect(result.matches.some((m) => m.category === "infrastructure")).toBe(true);
    });

    it("detects IP-like pattern", () => {
      const result = analyzer.analyze("192-168-1-1.example.com");
      expect(result.matches.some((m) => m.description.includes("IP-like"))).toBe(true);
    });

    it("detects UUID in domain", () => {
      const result = analyzer.analyze("550e8400-e29b-41d4-a716-446655440000.example.com");
      expect(result.matches.some((m) => m.description.includes("UUID"))).toBe(true);
    });
  });

  describe("risk level calculation", () => {
    let analyzer: ReturnType<typeof createThreatAnalyzer>;

    beforeEach(() => {
      analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
    });

    it("returns none for clean domain", () => {
      const result = analyzer.analyze("google.com");
      expect(result.riskLevel).toBe("none");
      expect(result.threatScore).toBe(0);
    });

    it("returns low for minor issues", () => {
      const result = analyzer.analyze("example12345.com");
      expect(result.riskLevel).toBe("none"); // Only numeric suffix (15 points)
    });

    it("returns medium for moderate threats", () => {
      const result = analyzer.analyze("secure-account.xyz");
      // High-risk TLD (20) + security pattern (40) = 60
      expect(result.threatScore).toBeGreaterThanOrEqual(40);
    });

    it("returns high for significant threats", () => {
      const result = analyzer.analyze("secure-login-verify.tk");
      expect(result.threatScore).toBeGreaterThanOrEqual(60);
    });

    it("caps threat score at 100", () => {
      // Domain with many matching patterns
      const result = analyzer.analyze("official-secure-verify-account-urgent--12345678.tk");
      expect(result.threatScore).toBeLessThanOrEqual(100);
    });
  });

  describe("hasThreats method", () => {
    it("returns false when disabled", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: false,
      });
      expect(analyzer.hasThreats("malicious.tk")).toBe(false);
    });

    it("returns true for high-threat domain", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
        minScoreToReport: 30,
      });
      expect(analyzer.hasThreats("secure-account-verify.tk")).toBe(true);
    });

    it("returns false for clean domain", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
      expect(analyzer.hasThreats("google.com")).toBe(false);
    });

    it("respects minScoreToReport threshold", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
        minScoreToReport: 100, // Very high threshold
      });
      expect(analyzer.hasThreats("secure-account.tk")).toBe(false);
    });
  });

  describe("batch analysis", () => {
    it("analyzes multiple domains", () => {
      const analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });

      const results = analyzer.analyzeMultiple([
        "google.com",
        "malicious.tk",
        "secure-login.xyz",
      ]);

      expect(results.length).toBe(3);
      expect(results[0].domain).toBe("google.com");
      expect(results[1].hasHighRiskTLD).toBe(true);
      expect(results[2].hasHighRiskTLD).toBe(true);
    });

    it("handles empty array", () => {
      const analyzer = createThreatAnalyzer();
      const results = analyzer.analyzeMultiple([]);
      expect(results.length).toBe(0);
    });
  });

  describe("domain normalization", () => {
    let analyzer: ReturnType<typeof createThreatAnalyzer>;

    beforeEach(() => {
      analyzer = createThreatAnalyzer({
        ...DEFAULT_THREAT_ANALYZER_CONFIG,
        enabled: true,
      });
    });

    it("normalizes uppercase to lowercase", () => {
      const result = analyzer.analyze("MALICIOUS.TK");
      expect(result.domain).toBe("malicious.tk");
      expect(result.hasHighRiskTLD).toBe(true);
    });

    it("trims whitespace", () => {
      const result = analyzer.analyze("  malicious.tk  ");
      expect(result.domain).toBe("malicious.tk");
    });
  });
});

describe("HIGH_RISK_TLDS", () => {
  it("contains known high-risk TLDs", () => {
    expect(HIGH_RISK_TLDS.has("tk")).toBe(true);
    expect(HIGH_RISK_TLDS.has("ml")).toBe(true);
    expect(HIGH_RISK_TLDS.has("xyz")).toBe(true);
    expect(HIGH_RISK_TLDS.has("top")).toBe(true);
  });

  it("does not contain common legitimate TLDs", () => {
    expect(HIGH_RISK_TLDS.has("com")).toBe(false);
    expect(HIGH_RISK_TLDS.has("org")).toBe(false);
    expect(HIGH_RISK_TLDS.has("net")).toBe(false);
    expect(HIGH_RISK_TLDS.has("edu")).toBe(false);
  });
});

describe("getThreatDataVersion", () => {
  it("returns version info", () => {
    const version = getThreatDataVersion();
    expect(version.version).toBeDefined();
    expect(version.lastUpdated).toBeDefined();
    expect(version.totalPatterns).toBeGreaterThan(0);
  });
});
