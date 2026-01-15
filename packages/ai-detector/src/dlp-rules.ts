/**
 * @fileoverview DLP (Data Loss Prevention) Rules
 *
 * DLPルールの管理と追加パターン検出を提供する。
 * - ルールの有効/無効化
 * - カスタムルール追加
 * - 追加のAPIキーパターン
 * - 日本固有のパターン
 */

import {
  detectSensitiveData,
  type DataClassification,
  type SensitiveDataResult,
} from "./sensitive-data-detector.js";

// ============================================================================
// Types
// ============================================================================

/**
 * DLPルール
 */
export interface DLPRule {
  id: string;
  name: string;
  description: string;
  classification: DataClassification;
  pattern: RegExp;
  confidence: "high" | "medium" | "low";
  enabled: boolean;
  custom?: boolean;
}

/**
 * DLPルール設定
 */
export interface DLPConfig {
  enabled: boolean;
  rules: DLPRule[];
  alertOnDetection: boolean;
  blockOnHighRisk: boolean;
}

/**
 * DLP検出結果
 */
export interface DLPDetectionResult extends SensitiveDataResult {
  ruleId: string;
  ruleName: string;
  blocked: boolean;
}

/**
 * DLP分析結果
 */
export interface DLPAnalysisResult {
  detected: DLPDetectionResult[];
  blocked: boolean;
  riskLevel: "critical" | "high" | "medium" | "low" | "none";
  summary: {
    total: number;
    byClassification: Record<DataClassification, number>;
    highConfidenceCount: number;
  };
}

// ============================================================================
// Extended Patterns
// ============================================================================

/**
 * 追加のDLPパターン
 */
export const EXTENDED_DLP_RULES: DLPRule[] = [
  // Additional API Keys
  {
    id: "google-api-key",
    name: "Google API Key",
    description: "Google Cloud/APIキー",
    classification: "credentials",
    pattern: /AIza[0-9A-Za-z-_]{35}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "azure-subscription-key",
    name: "Azure Subscription Key",
    description: "Azure Cognitive Services等",
    classification: "credentials",
    pattern: /[0-9a-f]{32}/gi,
    confidence: "low",
    enabled: false, // 誤検出が多いため無効
  },
  {
    id: "stripe-key",
    name: "Stripe API Key",
    description: "Stripe決済APIキー",
    classification: "credentials",
    pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "slack-token",
    name: "Slack Token",
    description: "Slack Bot/User Token",
    classification: "credentials",
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "twilio-key",
    name: "Twilio API Key",
    description: "Twilio SID/Auth Token",
    classification: "credentials",
    pattern: /(?:AC|SK)[a-f0-9]{32}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "sendgrid-key",
    name: "SendGrid API Key",
    description: "SendGrid メール送信キー",
    classification: "credentials",
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "mailchimp-key",
    name: "Mailchimp API Key",
    description: "Mailchimpキー",
    classification: "credentials",
    pattern: /[0-9a-f]{32}-us[0-9]{1,2}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jwt-token",
    name: "JWT Token",
    description: "JSON Web Token",
    classification: "credentials",
    pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "basic-auth",
    name: "Basic Auth Header",
    description: "Basic認証ヘッダー",
    classification: "credentials",
    pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/g,
    confidence: "high",
    enabled: true,
  },
  {
    id: "bearer-token",
    name: "Bearer Token",
    description: "Bearerトークン",
    classification: "credentials",
    pattern: /Bearer\s+[A-Za-z0-9-_.~+/]+=*/g,
    confidence: "medium",
    enabled: true,
  },

  // Japan-specific patterns
  {
    id: "my-number",
    name: "マイナンバー",
    description: "日本の個人番号（12桁）",
    classification: "pii",
    pattern: /(?:マイナンバー|個人番号|my\s*number)[\s:：]*[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jp-drivers-license",
    name: "運転免許証番号",
    description: "日本の運転免許証番号",
    classification: "pii",
    pattern: /(?:運転免許|免許証|driver.?license)[\s:：]*[0-9]{12}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jp-passport",
    name: "旅券番号",
    description: "日本のパスポート番号",
    classification: "pii",
    pattern: /(?:旅券番号|passport.?number)[\s:：]*[A-Z]{2}[0-9]{7}/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "jp-bank-code",
    name: "銀行コード・支店コード",
    description: "金融機関コード",
    classification: "financial",
    pattern: /(?:銀行コード|支店コード|branch.?code)[\s:：]*[0-9]{3,4}/gi,
    confidence: "medium",
    enabled: true,
  },

  // Network/URL patterns
  {
    id: "url-with-token",
    name: "URL内トークン",
    description: "URLに含まれるトークンやキー",
    classification: "credentials",
    pattern: /https?:\/\/[^\s]*[?&](?:token|key|api_key|access_token|secret)=[A-Za-z0-9-_.~+/]+/gi,
    confidence: "high",
    enabled: true,
  },
  {
    id: "connection-string",
    name: "接続文字列",
    description: "DB接続文字列等",
    classification: "credentials",
    pattern: /(?:mongodb|mysql|postgresql|redis|amqp):\/\/[^\s]+:[^\s]+@[^\s]+/gi,
    confidence: "high",
    enabled: true,
  },

  // Environment variables
  {
    id: "env-variable",
    name: "環境変数",
    description: "環境変数の値",
    classification: "internal",
    pattern: /(?:export\s+)?[A-Z_][A-Z0-9_]*=['""]?[^'"">\s]{10,}['""]?/g,
    confidence: "medium",
    enabled: true,
  },
];

// ============================================================================
// DLP Manager
// ============================================================================

/**
 * デフォルトDLP設定
 */
export const DEFAULT_DLP_CONFIG: DLPConfig = {
  enabled: true,
  rules: EXTENDED_DLP_RULES,
  alertOnDetection: true,
  blockOnHighRisk: false,
};

/**
 * DLPルールマネージャーを作成
 */
export function createDLPManager(config: DLPConfig = DEFAULT_DLP_CONFIG) {
  let currentConfig = { ...config };

  /**
   * 設定を更新
   */
  function updateConfig(updates: Partial<DLPConfig>): void {
    currentConfig = { ...currentConfig, ...updates };
  }

  /**
   * ルールを有効/無効化
   */
  function setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = currentConfig.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * カスタムルールを追加
   */
  function addCustomRule(rule: Omit<DLPRule, "custom">): void {
    currentConfig.rules.push({ ...rule, custom: true });
  }

  /**
   * カスタムルールを削除
   */
  function removeCustomRule(ruleId: string): boolean {
    const index = currentConfig.rules.findIndex(
      (r) => r.id === ruleId && r.custom
    );
    if (index !== -1) {
      currentConfig.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * テキストを分析
   */
  function analyze(text: string): DLPAnalysisResult {
    if (!currentConfig.enabled) {
      return {
        detected: [],
        blocked: false,
        riskLevel: "none",
        summary: {
          total: 0,
          byClassification: {
            credentials: 0,
            pii: 0,
            financial: 0,
            health: 0,
            code: 0,
            internal: 0,
            unknown: 0,
          },
          highConfidenceCount: 0,
        },
      };
    }

    // 基本検出
    const baseResults = detectSensitiveData(text);

    // 拡張ルール検出
    const extendedResults: DLPDetectionResult[] = [];

    for (const rule of currentConfig.rules.filter((r) => r.enabled)) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        extendedResults.push({
          classification: rule.classification,
          confidence: rule.confidence,
          pattern: rule.name,
          matchedText: maskText(match[0]),
          position: match.index,
          ruleId: rule.id,
          ruleName: rule.name,
          blocked: false,
        });
      }
    }

    // 基本結果をDLPDetectionResultに変換
    const convertedBaseResults: DLPDetectionResult[] = baseResults.map((r) => ({
      ...r,
      ruleId: "base-" + r.pattern.toLowerCase().replace(/\s+/g, "-"),
      ruleName: r.pattern,
      blocked: false,
    }));

    // 結果をマージ（重複を除去）
    const allResults = mergeResults([
      ...convertedBaseResults,
      ...extendedResults,
    ]);

    // ブロック判定
    const shouldBlock =
      currentConfig.blockOnHighRisk &&
      allResults.some(
        (r) =>
          r.confidence === "high" &&
          (r.classification === "credentials" || r.classification === "financial")
      );

    if (shouldBlock) {
      allResults.forEach((r) => {
        if (
          r.confidence === "high" &&
          (r.classification === "credentials" ||
            r.classification === "financial")
        ) {
          r.blocked = true;
        }
      });
    }

    // サマリー作成
    const summary = createSummary(allResults);
    const riskLevel = calculateRiskLevel(allResults);

    return {
      detected: allResults,
      blocked: shouldBlock,
      riskLevel,
      summary,
    };
  }

  /**
   * 有効なルール一覧を取得
   */
  function getEnabledRules(): DLPRule[] {
    return currentConfig.rules.filter((r) => r.enabled);
  }

  /**
   * 全ルール一覧を取得
   */
  function getAllRules(): DLPRule[] {
    return [...currentConfig.rules];
  }

  /**
   * 現在の設定を取得
   */
  function getConfig(): DLPConfig {
    return { ...currentConfig };
  }

  return {
    analyze,
    updateConfig,
    setRuleEnabled,
    addCustomRule,
    removeCustomRule,
    getEnabledRules,
    getAllRules,
    getConfig,
  };
}

export type DLPManager = ReturnType<typeof createDLPManager>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * テキストをマスク
 */
function maskText(text: string): string {
  if (text.length <= 4) return "****";
  const visibleStart = Math.min(4, Math.floor(text.length / 4));
  const visibleEnd = Math.min(4, Math.floor(text.length / 4));
  const maskedLength = text.length - visibleStart - visibleEnd;
  return (
    text.substring(0, visibleStart) +
    "*".repeat(maskedLength) +
    text.substring(text.length - visibleEnd)
  );
}

/**
 * 結果をマージ（位置が近い重複を除去）
 */
function mergeResults(results: DLPDetectionResult[]): DLPDetectionResult[] {
  const merged: DLPDetectionResult[] = [];

  for (const result of results) {
    const existing = merged.find(
      (m) =>
        m.position !== undefined &&
        result.position !== undefined &&
        Math.abs(m.position - result.position) < 5 &&
        m.classification === result.classification
    );

    if (!existing) {
      merged.push(result);
    }
  }

  return merged;
}

/**
 * サマリーを作成
 */
function createSummary(results: DLPDetectionResult[]): DLPAnalysisResult["summary"] {
  const byClassification: Record<DataClassification, number> = {
    credentials: 0,
    pii: 0,
    financial: 0,
    health: 0,
    code: 0,
    internal: 0,
    unknown: 0,
  };

  let highConfidenceCount = 0;

  for (const result of results) {
    byClassification[result.classification]++;
    if (result.confidence === "high") {
      highConfidenceCount++;
    }
  }

  return {
    total: results.length,
    byClassification,
    highConfidenceCount,
  };
}

/**
 * リスクレベルを計算
 */
function calculateRiskLevel(
  results: DLPDetectionResult[]
): DLPAnalysisResult["riskLevel"] {
  if (results.length === 0) return "none";

  const hasHighCredentials = results.some(
    (r) => r.classification === "credentials" && r.confidence === "high"
  );
  const hasHighFinancial = results.some(
    (r) => r.classification === "financial" && r.confidence === "high"
  );

  if (hasHighCredentials) return "critical";
  if (hasHighFinancial) return "high";

  const hasHighConfidence = results.some((r) => r.confidence === "high");
  if (hasHighConfidence) return "high";

  const hasMediumConfidence = results.some((r) => r.confidence === "medium");
  if (hasMediumConfidence) return "medium";

  return "low";
}
