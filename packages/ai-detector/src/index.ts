/**
 * @pleno-audit/ai-detector
 *
 * 入力検出パッケージ
 * AIサービスへのリクエスト/レスポンスを含む入力を検出・解析
 */

// Types - 新しい型
export type {
  AIDetectionMethod,
  CapturedInput,
  InputContent,
  InputResponseContent,
  InputMonitorConfig,
  InputCapturedDetails,
  // 後方互換エイリアス
  CapturedAIPrompt,
  AIPromptContent,
  AIResponseContent,
  AIMonitorConfig,
  // イベント詳細
  AIPromptSentDetails,
  AIResponseReceivedDetails,
} from "./types.js";

export {
  DEFAULT_INPUT_MONITOR_CONFIG,
  DEFAULT_AI_MONITOR_CONFIG,
} from "./types.js";

// Detector
export {
  isAIRequestBody,
  extractPromptContent,
  extractResponseContent,
} from "./detector.js";
