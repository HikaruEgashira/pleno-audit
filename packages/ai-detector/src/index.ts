/**
 * @pleno-audit/ai-detector
 *
 * AIプロンプト検出パッケージ
 * AIサービスへのリクエスト/レスポンスを検出・解析
 */

// Types
export type {
  InferredProvider,
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
  extractModel,
  extractResponseContent,
  inferProviderFromResponse,
} from "./detector.js";

// PII Analyzer
export {
  analyzePromptPII,
  calculatePromptRiskScore,
  scoreToRiskLevel,
  assessPromptRisk,
  analyzePrompt,
  type AIPromptPIIResult,
  type AIPromptRiskAssessment,
  type AIPromptAnalysisResult,
} from "./pii-analyzer.js";

// Provider Classifier (Shadow AI Detection)
export {
  classifyByModelName,
  classifyByUrl,
  classifyByResponseStructure,
  classifyProvider,
  getProviderInfo,
  isShadowAI,
  PROVIDER_INFO,
  type ExtendedProvider,
  type ProviderClassification,
  type ProviderInfo,
} from "./provider-classifier.js";
