/**
 * Input Monitoring Types
 * (AI監視を入力監視に拡張)
 */

// ============================================================================
// AI Service Detection（AIサービス検出）
// ============================================================================

/** AI検出方法 */
export type AIDetectionMethod =
  | "request_structure" // リクエストボディ構造
  | "response_structure"; // レスポンス構造

// ============================================================================
// Input Capture（入力キャプチャ）
// ============================================================================

/** キャプチャした入力 */
export interface CapturedInput {
  id: string;
  timestamp: number;

  // ページ情報
  pageUrl: string;
  apiEndpoint: string;

  // リクエスト情報
  method: string;

  // AI検知フラグ
  isAI: boolean;

  // コンテンツ情報
  content: InputContent;

  // レスポンス情報（オプション）
  response?: InputResponseContent;
  responseTimestamp?: number;
}

/** 入力コンテンツの内容 */
export interface InputContent {
  /** メッセージ配列形式（Chat Completion形式） */
  messages?: Array<{
    role: string;
    content: string;
  }>;

  /** 単一テキスト形式 */
  text?: string;

  /** 生のリクエストボディ */
  rawBody?: string;

  /** コンテンツサイズ（バイト） */
  contentSize: number;

  /** トランケートされたか */
  truncated: boolean;
}

/** レスポンスの内容 */
export interface InputResponseContent {
  /** レスポンステキスト */
  text?: string;

  /** ストリーミングだったか */
  isStreaming: boolean;

  /** 使用トークン数（AIの場合） */
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
// 後方互換エイリアス
// ============================================================================

/** @deprecated CapturedInputを使用してください */
export type CapturedAIPrompt = CapturedInput;

/** @deprecated InputContentを使用してください */
export type AIPromptContent = InputContent;

/** @deprecated InputResponseContentを使用してください */
export type AIResponseContent = InputResponseContent;

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

/** 入力キャプチャイベント詳細 */
export interface InputCapturedDetails {
  inputPreview: string;
  contentSize: number;
  endpoint: string;
}

// ============================================================================
// Configuration（設定）
// ============================================================================

/** 入力モニタリング設定 */
export interface InputMonitorConfig {
  /** 機能有効化 */
  enabled: boolean;

  /** すべてのPOSTをキャプチャ */
  captureAllPOST: boolean;

  /** レスポンスキャプチャ */
  captureResponses: boolean;

  /** 最大保存コンテンツサイズ（バイト） */
  maxContentSize: number;

  /** 最大保存レコード数 */
  maxStoredRecords: number;
}

/** デフォルト設定 */
export const DEFAULT_INPUT_MONITOR_CONFIG: InputMonitorConfig = {
  enabled: true,
  captureAllPOST: true,
  captureResponses: true,
  maxContentSize: 10000, // 10KB
  maxStoredRecords: 500,
};

/** @deprecated InputMonitorConfigを使用してください */
export type AIMonitorConfig = InputMonitorConfig;

/** @deprecated DEFAULT_INPUT_MONITOR_CONFIGを使用してください */
export const DEFAULT_AI_MONITOR_CONFIG: InputMonitorConfig = {
  ...DEFAULT_INPUT_MONITOR_CONFIG,
  captureAllPOST: false, // 後方互換のためAIのみ
};
