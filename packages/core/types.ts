export interface DetectedService {
  domain: string;
  detectedAt: number;
  hasLoginPage: boolean;
  privacyPolicyUrl: string | null;
  cookies: CookieInfo[];
}

export interface CookieInfo {
  name: string;
  domain: string;
  detectedAt: number;
  isSession: boolean;
}

export interface LoginDetectedDetails {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}

export interface PrivacyPolicyFoundDetails {
  url: string;
  method: string;
}

export interface CookieSetDetails {
  name: string;
  isSession: boolean;
}

export type EventLogBase<T extends string, D> = {
  id: string;
  type: T;
  domain: string;
  timestamp: number;
  details: D;
};

export type EventLog =
  | EventLogBase<"login_detected", LoginDetectedDetails>
  | EventLogBase<"privacy_policy_found", PrivacyPolicyFoundDetails>
  | EventLogBase<"cookie_set", CookieSetDetails>
  | EventLogBase<"csp_violation", CSPViolationDetails>
  | EventLogBase<"network_request", NetworkRequestDetails>;

export type EventLogType = EventLog["type"];

export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports?: CSPReport[];
  cspConfig?: CSPConfig;
}

// ---- CSP Auditor Types ----

export interface CSPViolation {
  type: "csp-violation";
  timestamp: string;
  pageUrl: string;
  directive: string;
  blockedURL: string;
  domain: string;
  disposition: "enforce" | "report";
  originalPolicy?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
}

export interface NetworkRequest {
  type: "network-request";
  timestamp: string;
  pageUrl: string;
  url: string;
  method: string;
  initiator:
    | "fetch"
    | "xhr"
    | "websocket"
    | "beacon"
    | "script"
    | "img"
    | "style"
    | "frame"
    | "font"
    | "media";
  domain: string;
  resourceType?: string;
}

export type CSPReport = CSPViolation | NetworkRequest;

export interface GeneratedCSPPolicy {
  policy: Record<string, string[]>;
  policyString: string;
  statistics: CSPStatistics;
  recommendations: SecurityRecommendation[];
}

export interface CSPStatistics {
  totalReports: number;
  cspViolations: number;
  networkRequests: number;
  uniqueDomains: string[];
  byDirective: Record<string, number>;
  byDomain: Record<string, number>;
}

export interface SecurityRecommendation {
  severity: "critical" | "high" | "medium" | "low";
  directive: string;
  message: string;
  suggestion: string;
}

export interface CSPConfig {
  enabled: boolean;
  collectNetworkRequests: boolean;
  collectCSPViolations: boolean;
  reportEndpoint: string | null;
  maxStoredReports: number;
}

export interface CSPGenerationOptions {
  strictMode: boolean;
  includeNonce: boolean;
  includeReportUri: boolean;
  reportUri: string;
  defaultSrc: string;
}

// CSP EventLog Details
export interface CSPViolationDetails {
  directive: string;
  blockedURL: string;
  disposition: "enforce" | "report";
}

export interface NetworkRequestDetails {
  url: string;
  method: string;
  initiator: string;
}
