/**
 * @pleno-audit/ai-detector
 *
 * AIプロンプト検出パッケージ
 * AIサービスへのリクエスト/レスポンスを検出・解析
 */

// Types
export type {
  AIDetectionMethod,
  CapturedAIPrompt,
  AIPromptContent,
  AIResponseContent,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  AIMonitorConfig,
} from "./types.js";

export { DEFAULT_AI_MONITOR_CONFIG } from "./types.js";

// Detector
export {
  isAIRequestBody,
  extractPromptContent,
  extractResponseContent,
} from "./detector.js";
