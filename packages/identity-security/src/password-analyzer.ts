/**
 * @fileoverview Password Strength Analyzer
 *
 * パスワード強度分析を行う。
 * - 強度スコア算出
 * - 弱いパターン検出
 * - 改善提案生成
 *
 * 注意: プライバシー保護のため、パスワード自体は保存しない。
 * 分析はリアルタイムで行い、結果のみを使用する。
 */

// ============================================================================
// Types
// ============================================================================

/**
 * パスワード強度レベル
 */
export type PasswordStrength = "very_weak" | "weak" | "fair" | "strong" | "very_strong";

/**
 * パスワード分析結果
 */
export interface PasswordAnalysis {
  strength: PasswordStrength;
  score: number; // 0-100
  issues: PasswordIssue[];
  suggestions: string[];
  checks: PasswordChecks;
}

/**
 * 各種チェック結果
 */
export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  noCommonPatterns: boolean;
  noSequentialChars: boolean;
  noRepeatedChars: boolean;
}

/**
 * パスワードの問題点
 */
export interface PasswordIssue {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

// ============================================================================
// Common Weak Patterns (ローカルで完結)
// ============================================================================

/**
 * 一般的な弱いパスワードパターン（ハッシュなし、ローカル検出）
 * 外部DB禁止ポリシーに準拠
 */
const COMMON_WEAK_PATTERNS = [
  // 数字のみ
  /^[0-9]+$/,
  // 連続した数字
  /^(123|1234|12345|123456|1234567|12345678|123456789|1234567890)$/,
  // キーボード配列
  /^(qwerty|qwertyuiop|asdfgh|asdfghjkl|zxcvbn|zxcvbnm)$/i,
  // 一般的な弱いパスワード
  /^(password|passwd|pass|admin|administrator|root|user|guest|login|welcome|letmein|monkey|dragon|master|sunshine|princess|football|baseball|soccer|hockey|batman|superman)$/i,
  // 年号パターン
  /^(19|20)\d{2}$/,
  // 単純な繰り返し
  /^(.)\1+$/,
];

/**
 * 連続文字パターン
 */
const SEQUENTIAL_PATTERNS = [
  "abcdefghijklmnopqrstuvwxyz",
  "zyxwvutsrqponmlkjihgfedcba",
  "0123456789",
  "9876543210",
  "qwertyuiop",
  "poiuytrewq",
  "asdfghjkl",
  "lkjhgfdsa",
  "zxcvbnm",
  "mnbvcxz",
];

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * パスワードの強度を分析
 */
export function analyzePassword(password: string): PasswordAnalysis {
  const checks: PasswordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /[0-9]/.test(password),
    symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password),
    noCommonPatterns: !hasCommonWeakPattern(password),
    noSequentialChars: !hasSequentialChars(password, 4),
    noRepeatedChars: !hasRepeatedChars(password, 3),
  };

  const issues = detectIssues(password, checks);
  const score = calculateScore(password, checks, issues);
  const strength = scoreToStrength(score);
  const suggestions = generateSuggestions(checks, issues);

  return {
    strength,
    score,
    issues,
    suggestions,
    checks,
  };
}

/**
 * 一般的な弱いパターンを持つか
 */
export function hasCommonWeakPattern(password: string): boolean {
  const lowerPassword = password.toLowerCase();

  for (const pattern of COMMON_WEAK_PATTERNS) {
    if (pattern.test(lowerPassword)) {
      return true;
    }
  }

  return false;
}

/**
 * 連続した文字を含むか
 */
export function hasSequentialChars(password: string, minLength: number = 4): boolean {
  const lowerPassword = password.toLowerCase();

  for (const seq of SEQUENTIAL_PATTERNS) {
    for (let i = 0; i <= seq.length - minLength; i++) {
      const subseq = seq.substring(i, i + minLength);
      if (lowerPassword.includes(subseq)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 繰り返し文字を含むか
 */
export function hasRepeatedChars(password: string, minRepeat: number = 3): boolean {
  if (password.length < minRepeat) return false;

  for (let i = 0; i <= password.length - minRepeat; i++) {
    const char = password[i];
    let count = 1;
    for (let j = i + 1; j < password.length && password[j] === char; j++) {
      count++;
    }
    if (count >= minRepeat) {
      return true;
    }
  }

  return false;
}

/**
 * 問題点を検出
 */
function detectIssues(password: string, checks: PasswordChecks): PasswordIssue[] {
  const issues: PasswordIssue[] = [];

  // 長さチェック
  if (password.length < 6) {
    issues.push({
      type: "too_short",
      severity: "critical",
      description: "パスワードが短すぎます（6文字未満）",
    });
  } else if (password.length < 8) {
    issues.push({
      type: "short",
      severity: "high",
      description: "パスワードが短いです（8文字未満）",
    });
  }

  // 文字種チェック
  const charTypesUsed = [
    checks.lowercase,
    checks.uppercase,
    checks.numbers,
    checks.symbols,
  ].filter(Boolean).length;

  if (charTypesUsed === 1) {
    issues.push({
      type: "single_char_type",
      severity: "high",
      description: "1種類の文字しか使用されていません",
    });
  } else if (charTypesUsed === 2) {
    issues.push({
      type: "limited_char_types",
      severity: "medium",
      description: "2種類の文字のみ使用されています",
    });
  }

  // パターンチェック
  if (!checks.noCommonPatterns) {
    issues.push({
      type: "common_pattern",
      severity: "critical",
      description: "一般的に使用される弱いパスワードパターンです",
    });
  }

  if (!checks.noSequentialChars) {
    issues.push({
      type: "sequential_chars",
      severity: "high",
      description: "連続した文字が含まれています",
    });
  }

  if (!checks.noRepeatedChars) {
    issues.push({
      type: "repeated_chars",
      severity: "medium",
      description: "同じ文字が連続しています",
    });
  }

  return issues;
}

/**
 * スコアを計算
 */
function calculateScore(
  password: string,
  checks: PasswordChecks,
  issues: PasswordIssue[]
): number {
  let score = 0;

  // 基本長さスコア (最大30点)
  score += Math.min(password.length * 3, 30);

  // 文字種スコア (各10点、最大40点)
  if (checks.lowercase) score += 10;
  if (checks.uppercase) score += 10;
  if (checks.numbers) score += 10;
  if (checks.symbols) score += 10;

  // 良好なパターンボーナス (最大30点)
  if (checks.noCommonPatterns) score += 10;
  if (checks.noSequentialChars) score += 10;
  if (checks.noRepeatedChars) score += 10;

  // 問題によるペナルティ
  for (const issue of issues) {
    switch (issue.severity) {
      case "critical":
        score -= 30;
        break;
      case "high":
        score -= 20;
        break;
      case "medium":
        score -= 10;
        break;
      case "low":
        score -= 5;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * スコアを強度に変換
 */
export function scoreToStrength(score: number): PasswordStrength {
  if (score >= 80) return "very_strong";
  if (score >= 60) return "strong";
  if (score >= 40) return "fair";
  if (score >= 20) return "weak";
  return "very_weak";
}

/**
 * 改善提案を生成
 */
function generateSuggestions(checks: PasswordChecks, issues: PasswordIssue[]): string[] {
  const suggestions: string[] = [];

  if (!checks.length) {
    suggestions.push("8文字以上のパスワードを使用してください");
  }

  if (!checks.lowercase) {
    suggestions.push("小文字(a-z)を追加してください");
  }

  if (!checks.uppercase) {
    suggestions.push("大文字(A-Z)を追加してください");
  }

  if (!checks.numbers) {
    suggestions.push("数字(0-9)を追加してください");
  }

  if (!checks.symbols) {
    suggestions.push("記号(!@#$%^&*など)を追加してください");
  }

  const hasCommonPatternIssue = issues.some((i) => i.type === "common_pattern");
  if (hasCommonPatternIssue) {
    suggestions.push("一般的なパスワードパターンを避けてください");
  }

  if (!checks.noSequentialChars) {
    suggestions.push("連続した文字（abc、123など）を避けてください");
  }

  if (!checks.noRepeatedChars) {
    suggestions.push("同じ文字の繰り返し（aaa、111など）を避けてください");
  }

  // 一般的な提案
  if (suggestions.length === 0) {
    suggestions.push("パスワードは定期的に変更することをお勧めします");
  }

  return suggestions;
}

/**
 * パスワード強度を判定（シンプル版）
 */
export function isStrongPassword(password: string): boolean {
  const analysis = analyzePassword(password);
  return analysis.strength === "strong" || analysis.strength === "very_strong";
}

/**
 * パスワード強度を判定（最低限の基準）
 */
export function meetsMinimumRequirements(password: string): boolean {
  const analysis = analyzePassword(password);
  return analysis.strength !== "very_weak" && analysis.strength !== "weak";
}
