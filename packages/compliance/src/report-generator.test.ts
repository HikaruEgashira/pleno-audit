import { describe, it, expect } from "vitest";
import {
  generateComplianceReport,
  exportReportJSON,
  exportReportMarkdown,
  type ComplianceInput,
} from "./report-generator.js";

function createEmptyInput(): ComplianceInput {
  return {
    services: [],
    events: [],
    aiPrompts: [],
    cspViolations: [],
    threats: [],
  };
}

function createTestPeriod(): { start: number; end: number } {
  return {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000,
    end: Date.now(),
  };
}

describe("generateComplianceReport", () => {
  describe("basic report structure", () => {
    it("generates report with required fields", () => {
      const report = generateComplianceReport(
        "soc2",
        createEmptyInput(),
        createTestPeriod()
      );

      expect(report.id).toBeDefined();
      expect(report.id).toMatch(/^report-/);
      expect(report.framework).toBe("soc2");
      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.controls).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it("includes metadata", () => {
      const report = generateComplianceReport(
        "gdpr",
        createEmptyInput(),
        createTestPeriod()
      );

      expect(report.metadata).toBeDefined();
      expect(report.metadata.totalDomains).toBe(0);
      expect(report.metadata.totalEvents).toBe(0);
      expect(report.metadata.scanDuration).toBeGreaterThanOrEqual(0);
    });

    it("generates 5 controls", () => {
      const report = generateComplianceReport(
        "soc2",
        createEmptyInput(),
        createTestPeriod()
      );

      expect(report.controls.length).toBe(5);
    });
  });

  describe("SOC2 framework", () => {
    it("uses SOC2 control IDs", () => {
      const report = generateComplianceReport(
        "soc2",
        createEmptyInput(),
        createTestPeriod()
      );

      const controlIds = report.controls.map((c) => c.id);
      expect(controlIds).toContain("CC6.1");
      expect(controlIds).toContain("CC6.6");
      expect(controlIds).toContain("CC7.2");
    });
  });

  describe("GDPR framework", () => {
    it("uses GDPR control IDs", () => {
      const report = generateComplianceReport(
        "gdpr",
        createEmptyInput(),
        createTestPeriod()
      );

      const controlIds = report.controls.map((c) => c.id);
      expect(controlIds).toContain("Art.25");
      expect(controlIds).toContain("Art.5");
    });
  });

  describe("access control checks", () => {
    it("detects login pages without policies", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        services: [
          {
            domain: "example.com",
            hasLoginPage: true,
            privacyPolicyUrl: null,
            termsOfServiceUrl: null,
            isNRD: false,
            isTyposquat: false,
            cookieCount: 5,
          },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const accessControl = report.controls.find((c) => c.name === "アクセス制御");

      expect(accessControl?.findings.length).toBeGreaterThan(0);
      expect(
        accessControl?.findings.some((f) => f.description.includes("ポリシー"))
      ).toBe(true);
    });

    it("detects NRD/typosquat domains", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        services: [
          {
            domain: "suspicious.xyz",
            hasLoginPage: false,
            privacyPolicyUrl: null,
            termsOfServiceUrl: null,
            isNRD: true,
            isTyposquat: false,
            cookieCount: 0,
          },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const accessControl = report.controls.find((c) => c.name === "アクセス制御");

      expect(accessControl?.status).toBe("non_compliant");
      expect(
        accessControl?.findings.some((f) => f.severity === "high")
      ).toBe(true);
    });
  });

  describe("data protection checks", () => {
    it("detects credential leaks in AI prompts", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        aiPrompts: [
          {
            domain: "openai.com",
            provider: "openai",
            hasSensitiveData: true,
            dataTypes: ["credentials"],
          },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const dataProtection = report.controls.find((c) => c.name === "データ保護");

      expect(dataProtection?.status).toBe("non_compliant");
      expect(
        dataProtection?.findings.some((f) => f.severity === "critical")
      ).toBe(true);
    });

    it("detects PII leaks in AI prompts", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        aiPrompts: [
          {
            domain: "openai.com",
            provider: "openai",
            hasSensitiveData: true,
            dataTypes: ["pii"],
          },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const dataProtection = report.controls.find((c) => c.name === "データ保護");

      expect(dataProtection?.status).toBe("partial");
      expect(
        dataProtection?.findings.some((f) => f.severity === "high")
      ).toBe(true);
    });

    it("passes when no sensitive data in prompts", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        aiPrompts: [
          {
            domain: "openai.com",
            provider: "openai",
            hasSensitiveData: false,
            dataTypes: [],
          },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const dataProtection = report.controls.find((c) => c.name === "データ保護");

      expect(dataProtection?.status).toBe("compliant");
    });
  });

  describe("network security checks", () => {
    it("detects excessive CSP violations", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        cspViolations: Array.from({ length: 60 }, (_, i) => ({
          domain: `site${i}.com`,
          directive: "script-src",
          blockedURL: `https://blocked${i}.com/script.js`,
        })),
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const networkSecurity = report.controls.find(
        (c) => c.name === "ネットワークセキュリティ"
      );

      expect(
        networkSecurity?.findings.some((f) => f.description.includes("CSP違反"))
      ).toBe(true);
    });

    it("detects critical threats", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        threats: [
          { domain: "malware.com", severity: "critical", category: "malware" },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const networkSecurity = report.controls.find(
        (c) => c.name === "ネットワークセキュリティ"
      );

      expect(networkSecurity?.status).toBe("non_compliant");
      expect(
        networkSecurity?.findings.some((f) => f.severity === "critical")
      ).toBe(true);
    });

    it("detects high severity threats", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        threats: [
          { domain: "suspicious.com", severity: "high", category: "phishing" },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const networkSecurity = report.controls.find(
        (c) => c.name === "ネットワークセキュリティ"
      );

      expect(
        networkSecurity?.findings.some((f) => f.severity === "high")
      ).toBe(true);
    });
  });

  describe("privacy checks", () => {
    it("passes with high privacy policy coverage", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        services: Array.from({ length: 10 }, (_, i) => ({
          domain: `site${i}.com`,
          hasLoginPage: false,
          privacyPolicyUrl: `https://site${i}.com/privacy`,
          termsOfServiceUrl: null,
          isNRD: false,
          isTyposquat: false,
          cookieCount: 5,
        })),
      };

      const report = generateComplianceReport("gdpr", input, createTestPeriod());
      const privacy = report.controls.find((c) => c.name === "プライバシー");

      expect(privacy?.status).toBe("compliant");
    });

    it("fails with low privacy policy coverage", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        services: [
          ...Array.from({ length: 3 }, (_, i) => ({
            domain: `with-policy${i}.com`,
            hasLoginPage: false,
            privacyPolicyUrl: `https://with-policy${i}.com/privacy`,
            termsOfServiceUrl: null,
            isNRD: false,
            isTyposquat: false,
            cookieCount: 5,
          })),
          ...Array.from({ length: 7 }, (_, i) => ({
            domain: `no-policy${i}.com`,
            hasLoginPage: false,
            privacyPolicyUrl: null,
            termsOfServiceUrl: null,
            isNRD: false,
            isTyposquat: false,
            cookieCount: 5,
          })),
        ],
      };

      const report = generateComplianceReport("gdpr", input, createTestPeriod());
      const privacy = report.controls.find((c) => c.name === "プライバシー");

      expect(privacy?.status).toBe("non_compliant");
    });
  });

  describe("monitoring checks", () => {
    it("passes with comprehensive event coverage", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        events: [
          { type: "login_detected", domain: "a.com", timestamp: Date.now(), details: {} },
          { type: "csp_violation", domain: "b.com", timestamp: Date.now(), details: {} },
          { type: "network_request", domain: "c.com", timestamp: Date.now(), details: {} },
          { type: "ai_prompt_sent", domain: "d.com", timestamp: Date.now(), details: {} },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const monitoring = report.controls.find((c) => c.name === "監視・ログ管理");

      expect(monitoring?.status).toBe("compliant");
    });

    it("partial with some event types", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        events: [
          { type: "login_detected", domain: "a.com", timestamp: Date.now(), details: {} },
          { type: "csp_violation", domain: "b.com", timestamp: Date.now(), details: {} },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());
      const monitoring = report.controls.find((c) => c.name === "監視・ログ管理");

      expect(monitoring?.status).toBe("partial");
    });
  });

  describe("summary calculation", () => {
    it("calculates overall score", () => {
      const report = generateComplianceReport(
        "soc2",
        createEmptyInput(),
        createTestPeriod()
      );

      expect(report.summary.score).toBeGreaterThanOrEqual(0);
      expect(report.summary.score).toBeLessThanOrEqual(100);
    });

    it("counts controls correctly", () => {
      const report = generateComplianceReport(
        "soc2",
        createEmptyInput(),
        createTestPeriod()
      );

      const { totalControls, compliantControls, partialControls, nonCompliantControls } =
        report.summary;

      expect(totalControls).toBe(5);
      expect(compliantControls + partialControls + nonCompliantControls).toBeLessThanOrEqual(
        totalControls
      );
    });

    it("counts findings by severity", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        aiPrompts: [
          {
            domain: "openai.com",
            provider: "openai",
            hasSensitiveData: true,
            dataTypes: ["credentials"],
          },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());

      expect(report.summary.criticalFindings).toBeGreaterThan(0);
    });
  });

  describe("recommendations", () => {
    it("generates recommendations for critical findings", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        threats: [
          { domain: "malware.com", severity: "critical", category: "malware" },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some((r) => r.includes("[緊急]"))).toBe(true);
    });

    it("generates recommendations for high severity findings", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        threats: [
          { domain: "phishing.com", severity: "high", category: "phishing" },
        ],
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());

      expect(report.recommendations.some((r) => r.includes("[重要]"))).toBe(true);
    });

    it("limits recommendations to 10", () => {
      const input: ComplianceInput = {
        ...createEmptyInput(),
        threats: Array.from({ length: 20 }, (_, i) => ({
          domain: `threat${i}.com`,
          severity: "high",
          category: "phishing",
        })),
      };

      const report = generateComplianceReport("soc2", input, createTestPeriod());

      expect(report.recommendations.length).toBeLessThanOrEqual(10);
    });
  });
});

describe("exportReportJSON", () => {
  it("exports valid JSON", () => {
    const report = generateComplianceReport(
      "soc2",
      createEmptyInput(),
      createTestPeriod()
    );

    const json = exportReportJSON(report);
    const parsed = JSON.parse(json);

    expect(parsed.framework).toBe("soc2");
    expect(parsed.controls).toBeDefined();
  });

  it("formats with indentation", () => {
    const report = generateComplianceReport(
      "soc2",
      createEmptyInput(),
      createTestPeriod()
    );

    const json = exportReportJSON(report);

    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });
});

describe("exportReportMarkdown", () => {
  it("exports markdown with title", () => {
    const report = generateComplianceReport(
      "soc2",
      createEmptyInput(),
      createTestPeriod()
    );

    const md = exportReportMarkdown(report);

    expect(md).toContain("# コンプライアンスレポート - SOC2");
  });

  it("includes summary section", () => {
    const report = generateComplianceReport(
      "soc2",
      createEmptyInput(),
      createTestPeriod()
    );

    const md = exportReportMarkdown(report);

    expect(md).toContain("## サマリー");
    expect(md).toContain("総合ステータス");
    expect(md).toContain("スコア");
  });

  it("includes controls section", () => {
    const report = generateComplianceReport(
      "soc2",
      createEmptyInput(),
      createTestPeriod()
    );

    const md = exportReportMarkdown(report);

    expect(md).toContain("## コントロール詳細");
    expect(md).toContain("### アクセス制御");
    expect(md).toContain("### データ保護");
  });

  it("includes findings when present", () => {
    const input: ComplianceInput = {
      ...createEmptyInput(),
      threats: [
        { domain: "malware.com", severity: "critical", category: "malware" },
      ],
    };

    const report = generateComplianceReport("soc2", input, createTestPeriod());
    const md = exportReportMarkdown(report);

    expect(md).toContain("**発見事項**");
    expect(md).toContain("[critical]");
  });

  it("includes recommendations section", () => {
    const input: ComplianceInput = {
      ...createEmptyInput(),
      threats: [
        { domain: "malware.com", severity: "critical", category: "malware" },
      ],
    };

    const report = generateComplianceReport("soc2", input, createTestPeriod());
    const md = exportReportMarkdown(report);

    expect(md).toContain("## 推奨事項");
  });

  it("handles GDPR framework", () => {
    const report = generateComplianceReport(
      "gdpr",
      createEmptyInput(),
      createTestPeriod()
    );

    const md = exportReportMarkdown(report);

    expect(md).toContain("# コンプライアンスレポート - GDPR");
  });
});
