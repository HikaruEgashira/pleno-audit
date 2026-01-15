/**
 * @fileoverview Identity Security Package
 *
 * パスワード強度分析と再利用検出機能を提供する。
 * 外部通信なしでローカル完結するプライバシー重視設計。
 */

// Password Analyzer
export {
  analyzePassword,
  hasCommonWeakPattern,
  hasSequentialChars,
  hasRepeatedChars,
  scoreToStrength,
  isStrongPassword,
  meetsMinimumRequirements,
  type PasswordStrength,
  type PasswordAnalysis,
  type PasswordChecks,
  type PasswordIssue,
} from "./password-analyzer.js";

// Password Reuse Detector
export {
  hashPassword,
  hashPasswordShort,
  createPasswordReuseDetector,
  type PasswordHashRecord,
  type ReuseDetectionResult,
  type PasswordReuseStore,
  type PasswordReuseDetector,
} from "./password-reuse-detector.js";
