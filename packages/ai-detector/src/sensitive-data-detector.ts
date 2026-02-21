/**
 * @fileoverview Re-export shim for backward compatibility
 *
 * 全機能は dlp-rules.ts に統合済み。
 */
export {
  type DataClassification,
  type SensitiveDataResult,
  detectSensitiveData,
  hasSensitiveData,
  getHighestRiskClassification,
  getSensitiveDataSummary,
} from "./dlp-rules.js";
