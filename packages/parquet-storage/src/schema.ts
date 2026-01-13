import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { ParquetEvent } from "./types";

// Parquetスキーマ定義（parquet-wasmで使用可能な形式）
export const SCHEMAS = {
  "csp-violations": {
    type: "struct",
    fields: [
      { name: "timestamp", type: "string" },
      { name: "pageUrl", type: "string" },
      { name: "directive", type: "string" },
      { name: "blockedURL", type: "string" },
      { name: "domain", type: "string" },
      { name: "disposition", type: { type: "option", inner: "string" } },
      { name: "originalPolicy", type: { type: "option", inner: "string" } },
      { name: "sourceFile", type: { type: "option", inner: "string" } },
      { name: "lineNumber", type: { type: "option", inner: "int32" } },
      { name: "columnNumber", type: { type: "option", inner: "int32" } },
      { name: "statusCode", type: { type: "option", inner: "int32" } },
    ],
  },

  "network-requests": {
    type: "struct",
    fields: [
      { name: "timestamp", type: "string" },
      { name: "pageUrl", type: "string" },
      { name: "url", type: "string" },
      { name: "method", type: "string" },
      { name: "initiator", type: "string" },
      { name: "domain", type: "string" },
      { name: "resourceType", type: { type: "option", inner: "string" } },
    ],
  },

  events: {
    type: "struct",
    fields: [
      { name: "id", type: "string" },
      { name: "type", type: "string" },
      { name: "domain", type: "string" },
      { name: "timestamp", type: "int64" },
      { name: "details", type: "string" },
    ],
  },

  "ai-prompts": {
    type: "struct",
    fields: [
      { name: "id", type: "string" },
      { name: "timestamp", type: "int64" },
      { name: "url", type: "string" },
      { name: "prompt", type: "string" },
      { name: "service", type: { type: "option", inner: "string" } },
    ],
  },

  "domain-risk-profiles": {
    type: "struct",
    fields: [
      { name: "domain", type: "string" },
      { name: "profiledAt", type: "int64" },
      { name: "isNRD", type: "bool" },
      { name: "isTyposquat", type: "bool" },
      { name: "hasLoginPage", type: "bool" },
      { name: "hasPrivacyPolicy", type: "bool" },
      { name: "hasTermsOfService", type: "bool" },
      { name: "hasAIActivity", type: "bool" },
      { name: "cookieCount", type: "int32" },
      { name: "faviconUrl", type: { type: "option", inner: "string" } },
      { name: "aiProviders", type: { type: "option", inner: "string" } },
      { name: "riskLevel", type: "string" },
    ],
  },
};

// CSPViolationをParquetレコードに変換
export function cspViolationToParquetRecord(
  v: CSPViolation
): Record<string, unknown> {
  return {
    timestamp: v.timestamp,
    pageUrl: v.pageUrl,
    directive: v.directive,
    blockedURL: v.blockedURL,
    domain: v.domain,
    disposition: v.disposition || null,
    originalPolicy: v.originalPolicy || null,
    sourceFile: v.sourceFile || null,
    lineNumber: v.lineNumber || null,
    columnNumber: v.columnNumber || null,
    statusCode: v.statusCode || null,
  };
}

// ParquetレコードをCSPViolationに変換
export function parquetRecordToCspViolation(
  record: Record<string, unknown>
): CSPViolation {
  return {
    type: "csp-violation",
    timestamp: record.timestamp as string,
    pageUrl: record.pageUrl as string,
    directive: record.directive as string,
    blockedURL: record.blockedURL as string,
    domain: record.domain as string,
    disposition: (record.disposition as "enforce" | "report" | null) || undefined,
    originalPolicy: (record.originalPolicy as string | null) || undefined,
    sourceFile: (record.sourceFile as string | null) || undefined,
    lineNumber: (record.lineNumber as number | null) || undefined,
    columnNumber: (record.columnNumber as number | null) || undefined,
    statusCode: (record.statusCode as number | null) || undefined,
  };
}

// NetworkRequestをParquetレコードに変換
export function networkRequestToParquetRecord(
  r: NetworkRequest
): Record<string, unknown> {
  return {
    timestamp: r.timestamp,
    pageUrl: r.pageUrl,
    url: r.url,
    method: r.method,
    initiator: r.initiator,
    domain: r.domain,
    resourceType: r.resourceType || null,
  };
}

// ParquetレコードをNetworkRequestに変換
export function parquetRecordToNetworkRequest(
  record: Record<string, unknown>
): NetworkRequest {
  return {
    type: "network-request",
    timestamp: record.timestamp as string,
    pageUrl: record.pageUrl as string,
    url: record.url as string,
    method: record.method as string,
    initiator: record.initiator as NetworkRequest["initiator"],
    domain: record.domain as string,
    resourceType: (record.resourceType as string | null) || undefined,
  };
}

// ParquetEventをレコードに変換
export function eventToParquetRecord(
  event: Omit<ParquetEvent, "id"> & { id?: string }
): Record<string, unknown> {
  return {
    id: event.id || generateId(),
    type: event.type,
    domain: event.domain,
    timestamp: event.timestamp,
    details: event.details,
  };
}

// Parquetレコードをイベントに変換
export function parquetRecordToEvent(
  record: Record<string, unknown>
): ParquetEvent {
  return {
    id: record.id as string,
    type: record.type as string,
    domain: record.domain as string,
    timestamp: record.timestamp as number,
    details: record.details as string,
  };
}

// ユーティリティ関数
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getDateString(timestamp?: number | string): string {
  const date = new Date(
    typeof timestamp === "number"
      ? timestamp
      : timestamp
      ? new Date(timestamp).getTime()
      : Date.now()
  );
  return date.toISOString().split("T")[0];
}

export function getParquetFileName(
  type: string,
  date: string
): string {
  return `pleno-logs-${type}-${date}.parquet`;
}

export function parseParquetFileName(fileName: string): {
  type: string;
  date: string;
} | null {
  const match = fileName.match(/^pleno-logs-(.+)-(\d{4}-\d{2}-\d{2})\.parquet$/);
  if (!match) return null;
  return { type: match[1], date: match[2] };
}

// Domain Risk Profileをレコードに変換
export function domainRiskProfileToParquetRecord(
  service: any // DetectedService
): Record<string, unknown> {
  // Risk levelの計算: 複数の危険要因がある場合はより高いレベルになる
  let riskLevel = "low";
  const riskFactors = [
    service.nrdResult?.isNRD || false,
    service.typosquatResult?.isTyposquat || false,
  ];
  const criticalFactors = riskFactors.filter(Boolean).length;

  if (criticalFactors >= 2) {
    riskLevel = "critical";
  } else if (criticalFactors === 1) {
    riskLevel = "high";
  } else if (
    service.aiDetected?.hasAIActivity ||
    (service.cookies && service.cookies.length > 0)
  ) {
    riskLevel = "medium";
  }

  return {
    domain: service.domain,
    profiledAt: Date.now(),
    isNRD: service.nrdResult?.isNRD || false,
    isTyposquat: service.typosquatResult?.isTyposquat || false,
    hasLoginPage: service.hasLoginPage || false,
    hasPrivacyPolicy: !!service.privacyPolicyUrl,
    hasTermsOfService: !!service.termsOfServiceUrl,
    hasAIActivity: service.aiDetected?.hasAIActivity || false,
    cookieCount: service.cookies?.length || 0,
    faviconUrl: service.faviconUrl || null,
    aiProviders: service.aiDetected?.providers?.join(",") || null,
    riskLevel,
  };
}
