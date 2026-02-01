import { describe, it, expect, vi } from "vitest";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { NRDResult, TyposquatResult } from "@pleno-audit/detectors";
import {
  SCHEMAS,
  cspViolationToParquetRecord,
  parquetRecordToCspViolation,
  networkRequestToParquetRecord,
  parquetRecordToNetworkRequest,
  eventToParquetRecord,
  parquetRecordToEvent,
  getDateString,
  getParquetFileName,
  parseParquetFileName,
  nrdResultToParquetRecord,
  typosquatResultToParquetRecord,
  cookieToParquetRecord,
  loginDetectionToParquetRecord,
  privacyPolicyToParquetRecord,
  termsOfServiceToParquetRecord,
  domainRiskProfileToParquetRecord,
  createServiceInventorySnapshot,
} from "./schema.js";

describe("SCHEMAS", () => {
  it("has csp-violations schema", () => {
    expect(SCHEMAS["csp-violations"]).toBeDefined();
    expect(SCHEMAS["csp-violations"].type).toBe("struct");
    expect(SCHEMAS["csp-violations"].fields).toBeInstanceOf(Array);
  });

  it("has network-requests schema", () => {
    expect(SCHEMAS["network-requests"]).toBeDefined();
    expect(SCHEMAS["network-requests"].type).toBe("struct");
    expect(SCHEMAS["network-requests"].fields).toBeInstanceOf(Array);
  });

  it("has events schema", () => {
    expect(SCHEMAS["events"]).toBeDefined();
    expect(SCHEMAS["events"].type).toBe("struct");
  });

  it("has ai-prompts schema", () => {
    expect(SCHEMAS["ai-prompts"]).toBeDefined();
    expect(SCHEMAS["ai-prompts"].type).toBe("struct");
  });

  it("has nrd-detections schema", () => {
    expect(SCHEMAS["nrd-detections"]).toBeDefined();
    expect(SCHEMAS["nrd-detections"].type).toBe("struct");
  });

  it("has typosquat-detections schema", () => {
    expect(SCHEMAS["typosquat-detections"]).toBeDefined();
    expect(SCHEMAS["typosquat-detections"].type).toBe("struct");
  });

  it("has cookies schema", () => {
    expect(SCHEMAS["cookies"]).toBeDefined();
    expect(SCHEMAS["cookies"].type).toBe("struct");
  });

  it("has login-detections schema", () => {
    expect(SCHEMAS["login-detections"]).toBeDefined();
    expect(SCHEMAS["login-detections"].type).toBe("struct");
  });

  it("has privacy-policies schema", () => {
    expect(SCHEMAS["privacy-policies"]).toBeDefined();
    expect(SCHEMAS["privacy-policies"].type).toBe("struct");
  });

  it("has terms-of-service schema", () => {
    expect(SCHEMAS["terms-of-service"]).toBeDefined();
    expect(SCHEMAS["terms-of-service"].type).toBe("struct");
  });

  it("has domain-risk-profiles schema", () => {
    expect(SCHEMAS["domain-risk-profiles"]).toBeDefined();
    expect(SCHEMAS["domain-risk-profiles"].type).toBe("struct");
  });

  it("has service-inventory schema", () => {
    expect(SCHEMAS["service-inventory"]).toBeDefined();
    expect(SCHEMAS["service-inventory"].type).toBe("struct");
  });

  describe("csp-violations schema fields", () => {
    const fields = SCHEMAS["csp-violations"].fields;

    it("has required fields", () => {
      const fieldNames = fields.map((f) => f.name);
      expect(fieldNames).toContain("timestamp");
      expect(fieldNames).toContain("pageUrl");
      expect(fieldNames).toContain("directive");
      expect(fieldNames).toContain("blockedURL");
      expect(fieldNames).toContain("domain");
    });

    it("has optional fields", () => {
      const fieldNames = fields.map((f) => f.name);
      expect(fieldNames).toContain("disposition");
      expect(fieldNames).toContain("originalPolicy");
      expect(fieldNames).toContain("sourceFile");
      expect(fieldNames).toContain("lineNumber");
      expect(fieldNames).toContain("columnNumber");
      expect(fieldNames).toContain("statusCode");
    });
  });
});

describe("cspViolationToParquetRecord", () => {
  it("converts violation to parquet record", () => {
    const violation: CSPViolation = {
      type: "csp-violation",
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      directive: "script-src",
      blockedURL: "https://evil.com/script.js",
      domain: "example.com",
      disposition: "enforce",
      originalPolicy: "script-src 'self'",
      sourceFile: "app.js",
      lineNumber: 10,
      columnNumber: 5,
      statusCode: 200,
    };

    const record = cspViolationToParquetRecord(violation);

    expect(record.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(record.pageUrl).toBe("https://example.com/page");
    expect(record.directive).toBe("script-src");
    expect(record.blockedURL).toBe("https://evil.com/script.js");
    expect(record.domain).toBe("example.com");
    expect(record.disposition).toBe("enforce");
    expect(record.originalPolicy).toBe("script-src 'self'");
    expect(record.sourceFile).toBe("app.js");
    expect(record.lineNumber).toBe(10);
    expect(record.columnNumber).toBe(5);
    expect(record.statusCode).toBe(200);
  });

  it("handles optional fields as null", () => {
    const violation: CSPViolation = {
      type: "csp-violation",
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      directive: "script-src",
      blockedURL: "https://evil.com/script.js",
      domain: "example.com",
    };

    const record = cspViolationToParquetRecord(violation);

    expect(record.disposition).toBeNull();
    expect(record.originalPolicy).toBeNull();
    expect(record.sourceFile).toBeNull();
    expect(record.lineNumber).toBeNull();
    expect(record.columnNumber).toBeNull();
    expect(record.statusCode).toBeNull();
  });
});

describe("parquetRecordToCspViolation", () => {
  it("converts parquet record to violation", () => {
    const record = {
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      directive: "script-src",
      blockedURL: "https://evil.com/script.js",
      domain: "example.com",
      disposition: "enforce",
      originalPolicy: "script-src 'self'",
      sourceFile: "app.js",
      lineNumber: 10,
      columnNumber: 5,
      statusCode: 200,
    };

    const violation = parquetRecordToCspViolation(record);

    expect(violation.type).toBe("csp-violation");
    expect(violation.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(violation.directive).toBe("script-src");
    expect(violation.disposition).toBe("enforce");
    expect(violation.lineNumber).toBe(10);
  });

  it("handles null fields as undefined", () => {
    const record = {
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      directive: "script-src",
      blockedURL: "https://evil.com/script.js",
      domain: "example.com",
      disposition: null,
      originalPolicy: null,
      sourceFile: null,
      lineNumber: null,
      columnNumber: null,
      statusCode: null,
    };

    const violation = parquetRecordToCspViolation(record);

    expect(violation.disposition).toBe("report"); // defaults to "report" when null
    expect(violation.originalPolicy).toBeUndefined();
    expect(violation.sourceFile).toBeUndefined();
    expect(violation.lineNumber).toBeUndefined();
    expect(violation.columnNumber).toBeUndefined();
    expect(violation.statusCode).toBeUndefined();
  });
});

describe("networkRequestToParquetRecord", () => {
  it("converts network request to parquet record", () => {
    const request: NetworkRequest = {
      type: "network-request",
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      url: "https://api.example.com/data",
      method: "POST",
      initiator: "fetch",
      domain: "example.com",
      resourceType: "xhr",
    };

    const record = networkRequestToParquetRecord(request);

    expect(record.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(record.pageUrl).toBe("https://example.com/page");
    expect(record.url).toBe("https://api.example.com/data");
    expect(record.method).toBe("POST");
    expect(record.initiator).toBe("fetch");
    expect(record.domain).toBe("example.com");
    expect(record.resourceType).toBe("xhr");
  });

  it("handles optional resourceType as null", () => {
    const request: NetworkRequest = {
      type: "network-request",
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      url: "https://api.example.com/data",
      method: "GET",
      initiator: "xhr",
      domain: "example.com",
    };

    const record = networkRequestToParquetRecord(request);

    expect(record.resourceType).toBeNull();
  });
});

describe("parquetRecordToNetworkRequest", () => {
  it("converts parquet record to network request", () => {
    const record = {
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      url: "https://api.example.com/data",
      method: "POST",
      initiator: "fetch",
      domain: "example.com",
      resourceType: "xhr",
    };

    const request = parquetRecordToNetworkRequest(record);

    expect(request.type).toBe("network-request");
    expect(request.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(request.method).toBe("POST");
    expect(request.resourceType).toBe("xhr");
  });

  it("handles null resourceType as undefined", () => {
    const record = {
      timestamp: "2024-01-01T00:00:00.000Z",
      pageUrl: "https://example.com/page",
      url: "https://api.example.com/data",
      method: "GET",
      initiator: "xhr",
      domain: "example.com",
      resourceType: null,
    };

    const request = parquetRecordToNetworkRequest(record);

    expect(request.resourceType).toBeUndefined();
  });
});

describe("eventToParquetRecord", () => {
  it("converts event with id to parquet record", () => {
    const event = {
      id: "test-id-123",
      type: "login",
      domain: "example.com",
      timestamp: 1704067200000,
      details: '{"hasPassword":true}',
    };

    const record = eventToParquetRecord(event);

    expect(record.id).toBe("test-id-123");
    expect(record.type).toBe("login");
    expect(record.domain).toBe("example.com");
    expect(record.timestamp).toBe(1704067200000);
    expect(record.details).toBe('{"hasPassword":true}');
  });

  it("generates id when not provided", () => {
    const event = {
      type: "login",
      domain: "example.com",
      timestamp: 1704067200000,
      details: "{}",
    };

    const record = eventToParquetRecord(event);

    expect(record.id).toBeDefined();
    expect(typeof record.id).toBe("string");
    expect((record.id as string).length).toBeGreaterThan(0);
  });
});

describe("parquetRecordToEvent", () => {
  it("converts parquet record to event", () => {
    const record = {
      id: "test-id-123",
      type: "login",
      domain: "example.com",
      timestamp: 1704067200000,
      details: '{"hasPassword":true}',
    };

    const event = parquetRecordToEvent(record);

    expect(event.id).toBe("test-id-123");
    expect(event.type).toBe("login");
    expect(event.domain).toBe("example.com");
    expect(event.timestamp).toBe(1704067200000);
    expect(event.details).toBe('{"hasPassword":true}');
  });
});

describe("getDateString", () => {
  it("returns date string from number timestamp", () => {
    const timestamp = Date.UTC(2024, 0, 15, 12, 0, 0); // 2024-01-15
    const result = getDateString(timestamp);
    expect(result).toBe("2024-01-15");
  });

  it("returns date string from ISO string timestamp", () => {
    const result = getDateString("2024-06-20T10:30:00.000Z");
    expect(result).toBe("2024-06-20");
  });

  it("returns current date when no timestamp provided", () => {
    const result = getDateString();
    const today = new Date().toISOString().split("T")[0];
    expect(result).toBe(today);
  });

  it("handles undefined timestamp", () => {
    const result = getDateString(undefined);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getParquetFileName", () => {
  it("generates correct file name", () => {
    const result = getParquetFileName("events", "2024-01-15");
    expect(result).toBe("pleno-logs-events-2024-01-15.parquet");
  });

  it("generates file name for csp-violations", () => {
    const result = getParquetFileName("csp-violations", "2024-06-20");
    expect(result).toBe("pleno-logs-csp-violations-2024-06-20.parquet");
  });

  it("generates file name for network-requests", () => {
    const result = getParquetFileName("network-requests", "2024-12-31");
    expect(result).toBe("pleno-logs-network-requests-2024-12-31.parquet");
  });
});

describe("parseParquetFileName", () => {
  it("parses valid file name", () => {
    const result = parseParquetFileName("pleno-logs-events-2024-01-15.parquet");
    expect(result).toEqual({ type: "events", date: "2024-01-15" });
  });

  it("parses file name with hyphenated type", () => {
    const result = parseParquetFileName("pleno-logs-csp-violations-2024-06-20.parquet");
    expect(result).toEqual({ type: "csp-violations", date: "2024-06-20" });
  });

  it("parses file name with network-requests type", () => {
    const result = parseParquetFileName("pleno-logs-network-requests-2024-12-31.parquet");
    expect(result).toEqual({ type: "network-requests", date: "2024-12-31" });
  });

  it("returns null for invalid file name", () => {
    expect(parseParquetFileName("invalid.parquet")).toBeNull();
    expect(parseParquetFileName("pleno-logs-2024-01-15.parquet")).toBeNull();
    expect(parseParquetFileName("other-events-2024-01-15.parquet")).toBeNull();
  });

  it("returns null for non-parquet extension", () => {
    expect(parseParquetFileName("pleno-logs-events-2024-01-15.json")).toBeNull();
  });
});

describe("nrdResultToParquetRecord", () => {
  it("converts full NRD result to parquet record", () => {
    const result: NRDResult = {
      domain: "newdomain.xyz",
      checkedAt: 1704067200000,
      isNRD: true,
      confidence: "high",
      domainAge: 5,
      registrationDate: "2024-01-10",
      method: "heuristic",
      suspiciousScores: { totalScore: 85 },
      ddns: { isDDNS: true, provider: "duckdns" },
    } as NRDResult;

    const record = nrdResultToParquetRecord(result);

    expect(record.domain).toBe("newdomain.xyz");
    expect(record.checkedAt).toBe(1704067200000);
    expect(record.isNRD).toBe(true);
    expect(record.confidence).toBe("high");
    expect(record.domainAge).toBe(5);
    expect(record.registrationDate).toBe("2024-01-10");
    expect(record.method).toBe("heuristic");
    expect(record.suspiciousScore).toBe(85);
    expect(record.isDDNS).toBe(true);
    expect(record.ddnsProvider).toBe("duckdns");
  });

  it("handles minimal NRD result", () => {
    const result: NRDResult = {
      domain: "example.com",
      checkedAt: 1704067200000,
      isNRD: false,
      confidence: "low",
      method: "cache",
    } as NRDResult;

    const record = nrdResultToParquetRecord(result);

    expect(record.domain).toBe("example.com");
    expect(record.isNRD).toBe(false);
    expect(record.domainAge).toBeNull();
    expect(record.registrationDate).toBeNull();
    expect(record.suspiciousScore).toBeNull();
    expect(record.isDDNS).toBe(false);
    expect(record.ddnsProvider).toBeNull();
  });
});

describe("typosquatResultToParquetRecord", () => {
  it("converts full typosquat result to parquet record", () => {
    const result: TyposquatResult = {
      domain: "g00gle.com",
      checkedAt: 1704067200000,
      isTyposquat: true,
      confidence: "high",
      heuristics: {
        totalScore: 75,
        homoglyphs: [{ char: "0", replaced: "o" }],
        hasMixedScript: true,
        detectedScripts: ["Latin", "Cyrillic"],
      },
    } as TyposquatResult;

    const record = typosquatResultToParquetRecord(result);

    expect(record.domain).toBe("g00gle.com");
    expect(record.checkedAt).toBe(1704067200000);
    expect(record.isTyposquat).toBe(true);
    expect(record.confidence).toBe("high");
    expect(record.totalScore).toBe(75);
    expect(record.homoglyphCount).toBe(1);
    expect(record.hasMixedScript).toBe(true);
    expect(record.detectedScripts).toBe("Latin,Cyrillic");
  });

  it("handles minimal typosquat result", () => {
    const result: TyposquatResult = {
      domain: "example.com",
      checkedAt: 1704067200000,
      isTyposquat: false,
      confidence: "low",
    } as TyposquatResult;

    const record = typosquatResultToParquetRecord(result);

    expect(record.domain).toBe("example.com");
    expect(record.isTyposquat).toBe(false);
    expect(record.totalScore).toBe(0);
    expect(record.homoglyphCount).toBe(0);
    expect(record.hasMixedScript).toBe(false);
    expect(record.detectedScripts).toBe("");
  });
});

describe("cookieToParquetRecord", () => {
  it("converts full cookie to parquet record", () => {
    const cookie = {
      domain: "example.com",
      name: "session_id",
      detectedAt: 1704067200000,
      value: "abc123",
      isSession: false,
      expirationDate: 1735689600000,
      secure: true,
      httpOnly: true,
      sameSite: "strict",
    };

    const record = cookieToParquetRecord(cookie);

    expect(record.domain).toBe("example.com");
    expect(record.name).toBe("session_id");
    expect(record.detectedAt).toBe(1704067200000);
    expect(record.value).toBe("abc123");
    expect(record.isSession).toBe(false);
    expect(record.expirationDate).toBe(1735689600000);
    expect(record.secure).toBe(true);
    expect(record.httpOnly).toBe(true);
    expect(record.sameSite).toBe("strict");
  });

  it("handles minimal cookie", () => {
    const cookie = {
      domain: "example.com",
      name: "temp",
      detectedAt: 1704067200000,
    };

    const record = cookieToParquetRecord(cookie);

    expect(record.domain).toBe("example.com");
    expect(record.name).toBe("temp");
    expect(record.value).toBeNull();
    expect(record.isSession).toBe(false);
    expect(record.expirationDate).toBeNull();
    expect(record.secure).toBeNull();
    expect(record.httpOnly).toBeNull();
    expect(record.sameSite).toBeNull();
  });
});

describe("loginDetectionToParquetRecord", () => {
  it("converts login detection to parquet record", () => {
    const login = {
      hasPasswordInput: true,
      isLoginUrl: true,
    };

    const record = loginDetectionToParquetRecord("example.com", login, 1704067200000);

    expect(record.domain).toBe("example.com");
    expect(record.detectedAt).toBe(1704067200000);
    expect(record.hasPasswordInput).toBe(true);
    expect(record.isLoginUrl).toBe(true);
  });

  it("handles empty login details", () => {
    const record = loginDetectionToParquetRecord("example.com", {}, 1704067200000);

    expect(record.domain).toBe("example.com");
    expect(record.hasPasswordInput).toBe(false);
    expect(record.isLoginUrl).toBe(false);
  });
});

describe("privacyPolicyToParquetRecord", () => {
  it("converts privacy policy to parquet record", () => {
    const record = privacyPolicyToParquetRecord(
      "example.com",
      "https://example.com/privacy",
      "url_pattern",
      1704067200000
    );

    expect(record.domain).toBe("example.com");
    expect(record.url).toBe("https://example.com/privacy");
    expect(record.method).toBe("url_pattern");
    expect(record.detectedAt).toBe(1704067200000);
  });
});

describe("termsOfServiceToParquetRecord", () => {
  it("converts terms of service to parquet record", () => {
    const record = termsOfServiceToParquetRecord(
      "example.com",
      "https://example.com/tos",
      "link_text",
      1704067200000
    );

    expect(record.domain).toBe("example.com");
    expect(record.url).toBe("https://example.com/tos");
    expect(record.method).toBe("link_text");
    expect(record.detectedAt).toBe(1704067200000);
  });
});

describe("domainRiskProfileToParquetRecord", () => {
  it("assigns critical risk for NRD and typosquat", () => {
    const service = {
      domain: "malicious.tk",
      nrdResult: { isNRD: true },
      typosquatResult: { isTyposquat: true },
      hasLoginPage: true,
      privacyPolicyUrl: "https://malicious.tk/privacy",
    };

    const record = domainRiskProfileToParquetRecord(service);

    expect(record.domain).toBe("malicious.tk");
    expect(record.isNRD).toBe(true);
    expect(record.isTyposquat).toBe(true);
    expect(record.riskLevel).toBe("critical");
  });

  it("assigns high risk for NRD only", () => {
    const service = {
      domain: "newsite.xyz",
      nrdResult: { isNRD: true },
      typosquatResult: { isTyposquat: false },
    };

    const record = domainRiskProfileToParquetRecord(service);

    expect(record.riskLevel).toBe("high");
  });

  it("assigns medium risk for AI activity", () => {
    const service = {
      domain: "ai-service.com",
      nrdResult: { isNRD: false },
      typosquatResult: { isTyposquat: false },
      aiDetected: { hasAIActivity: true, providers: ["openai"] },
    };

    const record = domainRiskProfileToParquetRecord(service);

    expect(record.riskLevel).toBe("medium");
    expect(record.hasAIActivity).toBe(true);
    expect(record.aiProviders).toBe("openai");
  });

  it("assigns medium risk for cookies present", () => {
    const service = {
      domain: "example.com",
      nrdResult: { isNRD: false },
      typosquatResult: { isTyposquat: false },
      cookies: [{ name: "session" }],
    };

    const record = domainRiskProfileToParquetRecord(service);

    expect(record.riskLevel).toBe("medium");
    expect(record.cookieCount).toBe(1);
  });

  it("assigns low risk for safe domain", () => {
    const service = {
      domain: "safe.com",
      nrdResult: { isNRD: false },
      typosquatResult: { isTyposquat: false },
      hasLoginPage: false,
    };

    const record = domainRiskProfileToParquetRecord(service);

    expect(record.riskLevel).toBe("low");
    expect(record.hasLoginPage).toBe(false);
  });

  it("includes all profile fields", () => {
    const service = {
      domain: "example.com",
      hasLoginPage: true,
      privacyPolicyUrl: "https://example.com/privacy",
      termsOfServiceUrl: "https://example.com/tos",
      faviconUrl: "https://example.com/favicon.ico",
      aiDetected: { hasAIActivity: true, providers: ["openai", "anthropic"] },
      cookies: [{ name: "a" }, { name: "b" }],
    };

    const record = domainRiskProfileToParquetRecord(service);

    expect(record.hasLoginPage).toBe(true);
    expect(record.hasPrivacyPolicy).toBe(true);
    expect(record.hasTermsOfService).toBe(true);
    expect(record.faviconUrl).toBe("https://example.com/favicon.ico");
    expect(record.aiProviders).toBe("openai,anthropic");
    expect(record.cookieCount).toBe(2);
    expect(record.profiledAt).toBeDefined();
  });
});

describe("createServiceInventorySnapshot", () => {
  it("creates snapshot from empty services", () => {
    const snapshot = createServiceInventorySnapshot({});

    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.snapshotAt).toBeDefined();
    expect(snapshot.totalServices).toBe(0);
    expect(snapshot.servicesWithLogin).toBe(0);
    expect(snapshot.servicesWithPrivacy).toBe(0);
    expect(snapshot.servicesWithTos).toBe(0);
    expect(snapshot.servicesWithNRD).toBe(0);
    expect(snapshot.servicesWithTyposquat).toBe(0);
    expect(snapshot.servicesWithAI).toBe(0);
    expect(snapshot.totalCookies).toBe(0);
    expect(snapshot.highRiskDomains).toBe("");
    expect(snapshot.criticalRiskDomains).toBe("");
  });

  it("calculates counts correctly", () => {
    const services = {
      "example.com": {
        domain: "example.com",
        hasLoginPage: true,
        privacyPolicyUrl: "https://example.com/privacy",
        termsOfServiceUrl: "https://example.com/tos",
        cookies: [{ name: "a" }, { name: "b" }],
      },
      "api.example.com": {
        domain: "api.example.com",
        aiDetected: { hasAIActivity: true },
      },
    };

    const snapshot = createServiceInventorySnapshot(services);

    expect(snapshot.totalServices).toBe(2);
    expect(snapshot.servicesWithLogin).toBe(1);
    expect(snapshot.servicesWithPrivacy).toBe(1);
    expect(snapshot.servicesWithTos).toBe(1);
    expect(snapshot.servicesWithAI).toBe(1);
    expect(snapshot.totalCookies).toBe(2);
  });

  it("identifies high risk domains", () => {
    const services = {
      "newsite.xyz": {
        domain: "newsite.xyz",
        nrdResult: { isNRD: true },
      },
      "typo-google.com": {
        domain: "typo-google.com",
        typosquatResult: { isTyposquat: true },
      },
      "safe.com": {
        domain: "safe.com",
      },
    };

    const snapshot = createServiceInventorySnapshot(services);

    expect(snapshot.servicesWithNRD).toBe(1);
    expect(snapshot.servicesWithTyposquat).toBe(1);
    expect(snapshot.highRiskDomains).toContain("newsite.xyz");
    expect(snapshot.highRiskDomains).toContain("typo-google.com");
    expect(snapshot.criticalRiskDomains).toBe("");
  });

  it("identifies critical risk domains", () => {
    const services = {
      "malicious.tk": {
        domain: "malicious.tk",
        nrdResult: { isNRD: true },
        typosquatResult: { isTyposquat: true },
      },
    };

    const snapshot = createServiceInventorySnapshot(services);

    expect(snapshot.criticalRiskDomains).toBe("malicious.tk");
    expect(snapshot.highRiskDomains).toBe("");
  });

  it("generates unique snapshot ID", () => {
    const snapshot1 = createServiceInventorySnapshot({});
    const snapshot2 = createServiceInventorySnapshot({});

    expect(snapshot1.snapshotId).not.toBe(snapshot2.snapshotId);
  });

  it("filters out null services", () => {
    const services = {
      "example.com": {
        domain: "example.com",
        hasLoginPage: true,
      },
      "null.com": null,
      "undefined.com": undefined,
    };

    const snapshot = createServiceInventorySnapshot(services);

    expect(snapshot.totalServices).toBe(1);
  });
});
