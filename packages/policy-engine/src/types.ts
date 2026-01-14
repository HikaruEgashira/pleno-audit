/**
 * @fileoverview Policy Engine Types
 *
 * Custom security policy definitions and violation detection.
 * Wiz-style policy-as-code for browser security.
 */

/**
 * Policy severity
 */
export type PolicySeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Policy category
 */
export type PolicyCategory =
  | "data_protection"
  | "access_control"
  | "network_security"
  | "ai_governance"
  | "compliance"
  | "privacy";

/**
 * Condition operator
 */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "greater_than"
  | "less_than"
  | "in_list"
  | "not_in_list";

/**
 * Policy condition
 */
export interface PolicyCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

/**
 * Policy rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  enabled: boolean;
  conditions: PolicyCondition[];
  conditionLogic: "and" | "or";
  remediation: string;
  tags: string[];
}

/**
 * Policy violation
 */
export interface PolicyViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: PolicySeverity;
  category: PolicyCategory;
  domain: string;
  description: string;
  remediation: string;
  timestamp: number;
  context: Record<string, unknown>;
  acknowledged: boolean;
}

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  domain: string;
  isNRD?: boolean;
  isTyposquat?: boolean;
  hasLogin?: boolean;
  hasPrivacyPolicy?: boolean;
  hasTermsOfService?: boolean;
  cookieCount?: number;
  isAIProvider?: boolean;
  aiProvider?: string;
  hasSensitiveData?: boolean;
  sensitiveDataTypes?: string[];
  cspViolationCount?: number;
  [key: string]: unknown;
}

/**
 * Default security policies
 */
export const DEFAULT_POLICIES: PolicyRule[] = [
  // Data Protection
  {
    id: "dp-001",
    name: "NRDサイトへのアクセス禁止",
    description: "新規登録ドメイン（30日以内）へのアクセスを検出",
    category: "data_protection",
    severity: "high",
    enabled: true,
    conditions: [{ field: "isNRD", operator: "equals", value: true }],
    conditionLogic: "and",
    remediation: "このドメインが正当なサービスであることを確認してください。フィッシングの可能性があります。",
    tags: ["nrd", "phishing"],
  },
  {
    id: "dp-002",
    name: "タイポスクワット検出",
    description: "正規サイトの偽装の可能性があるドメインを検出",
    category: "data_protection",
    severity: "critical",
    enabled: true,
    conditions: [{ field: "isTyposquat", operator: "equals", value: true }],
    conditionLogic: "and",
    remediation: "URLを再確認し、正規サイトにアクセスしていることを確認してください。",
    tags: ["typosquat", "phishing"],
  },
  // AI Governance
  {
    id: "ai-002",
    name: "機密データのAI送信",
    description: "認証情報やPIIをAIサービスに送信することを検出",
    category: "ai_governance",
    severity: "critical",
    enabled: true,
    conditions: [
      { field: "isAIProvider", operator: "equals", value: true },
      { field: "hasSensitiveData", operator: "equals", value: true },
    ],
    conditionLogic: "and",
    remediation: "機密情報をAIサービスに送信しないでください。データのマスキングを検討してください。",
    tags: ["ai", "data-leak", "pii"],
  },
  // Privacy
  {
    id: "priv-001",
    name: "プライバシーポリシー未確認サイト",
    description: "プライバシーポリシーが確認できないサイトでのログイン検出",
    category: "privacy",
    severity: "medium",
    enabled: true,
    conditions: [
      { field: "hasLogin", operator: "equals", value: true },
      { field: "hasPrivacyPolicy", operator: "equals", value: false },
    ],
    conditionLogic: "and",
    remediation: "プライバシーポリシーを確認してから個人情報を入力してください。",
    tags: ["privacy", "login"],
  },
  // Network Security
  {
    id: "net-001",
    name: "過剰なCSP違反",
    description: "CSP違反が多数検出されたサイト",
    category: "network_security",
    severity: "medium",
    enabled: true,
    conditions: [{ field: "cspViolationCount", operator: "greater_than", value: 10 }],
    conditionLogic: "and",
    remediation: "サードパーティスクリプトの信頼性を確認してください。",
    tags: ["csp", "third-party"],
  },
];
