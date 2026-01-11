/**
 * AI Prompt Monitoring Types
 */

// ============================================================================
// AI Service Detection（AIサービス検出）
// ============================================================================

/** AI検出方法 */
export type AIDetectionMethod =
  | "request_structure" // リクエストボディ構造
  | "response_structure"; // レスポンス構造

// ============================================================================
// AI Prompt/Response Capture（プロンプト/レスポンスキャプチャ）
// ============================================================================

/** キャプチャしたAIプロンプト */
export interface CapturedAIPrompt {
  id: string;
  timestamp: number;

  // ページ情報
  pageUrl: string;
  apiEndpoint: string;

  // リクエスト情報
  method: string;

  // プロンプト情報
  prompt: AIPromptContent;

  // レスポンス情報（オプション）
  response?: AIResponseContent;
  responseTimestamp?: number;
}

/** AIプロンプトの内容 */
export interface AIPromptContent {
  /** メッセージ配列形式（Chat Completion形式） */
  messages?: Array<{
    role: string;
    content: string;
  }>;

  /** 単一プロンプト形式（Completion API等） */
  text?: string;

  /** 生のリクエストボディ（解析できない場合） */
  rawBody?: string;

  /** コンテンツサイズ（バイト） */
  contentSize: number;

  /** トランケートされたか */
  truncated: boolean;
}

/** AIレスポンスの内容 */
export interface AIResponseContent {
  /** アシスタントのレスポンステキスト */
  text?: string;

  /** ストリーミングだったか */
  isStreaming: boolean;

  /** 使用トークン数 */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  /** コンテンツサイズ（バイト） */
  contentSize: number;

  /** トランケートされたか */
  truncated: boolean;

  /** レスポンス時間（ms） */
  latencyMs?: number;
}

// ============================================================================
// Event Log Integration（イベントログ統合）
// ============================================================================

/** AIプロンプト送信イベント詳細 */
export interface AIPromptSentDetails {
  promptPreview: string;
  contentSize: number;
  messageCount?: number;
}

/** AIレスポンス受信イベント詳細 */
export interface AIResponseReceivedDetails {
  responsePreview: string;
  contentSize: number;
  latencyMs?: number;
  isStreaming: boolean;
}

// ============================================================================
// Configuration（設定）
// ============================================================================

/** AIモニタリング設定 */
export interface AIMonitorConfig {
  /** 機能有効化 */
  enabled: boolean;

  /** プロンプトキャプチャ */
  capturePrompts: boolean;

  /** レスポンスキャプチャ */
  captureResponses: boolean;

  /** 最大保存コンテンツサイズ（バイト） */
  maxContentSize: number;

  /** 最大保存レコード数 */
  maxStoredRecords: number;
}

/** デフォルト設定 */
export const DEFAULT_AI_MONITOR_CONFIG: AIMonitorConfig = {
  enabled: true,
  capturePrompts: true,
  captureResponses: true,
  maxContentSize: 10000, // 10KB
  maxStoredRecords: 500,
};
