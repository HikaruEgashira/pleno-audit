/**
 * @fileoverview Sensitive Data Detector
 *
 * Detects sensitive/classified data in text content,
 * particularly in AI prompts for DSPM functionality.
 */

import type { DataClassification } from "./types.js";

/**
 * Detection result for sensitive data
 */
export interface SensitiveDataResult {
  classification: DataClassification;
  confidence: "high" | "medium" | "low";
  pattern: string;
  matchedText?: string;
  position?: number;
}

/**
 * Pattern definitions for sensitive data detection
 */
const PATTERNS: Array<{
  classification: DataClassification;
  pattern: RegExp;
  confidence: "high" | "medium" | "low";
  name: string;
}> = [
  // Credentials - High confidence
  {
    classification: "credentials",
    pattern:
      /(?:api[_-]?key|apikey|api_secret|secret_key|access_token|auth_token|bearer)[\s:="']+[a-zA-Z0-9_-]{20,}/gi,
    confidence: "high",
    name: "API Key",
  },
  {
    classification: "credentials",
    pattern: /(?:password|passwd|pwd)[\s:="']+[^\s"']{8,}/gi,
    confidence: "high",
    name: "Password",
  },
  {
    classification: "credentials",
    pattern: /sk-[a-zA-Z0-9]{32,}/g, // OpenAI API key format
    confidence: "high",
    name: "OpenAI API Key",
  },
  {
    classification: "credentials",
    pattern: /sk-ant-[a-zA-Z0-9-]{80,}/g, // Anthropic API key format
    confidence: "high",
    name: "Anthropic API Key",
  },
  {
    classification: "credentials",
    pattern: /ghp_[a-zA-Z0-9]{36}/g, // GitHub personal access token
    confidence: "high",
    name: "GitHub Token",
  },
  {
    classification: "credentials",
    pattern: /gho_[a-zA-Z0-9]{36}/g, // GitHub OAuth token
    confidence: "high",
    name: "GitHub OAuth Token",
  },
  {
    classification: "credentials",
    pattern: /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
    confidence: "high",
    name: "AWS Access Key",
  },
  {
    classification: "credentials",
    pattern: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/g,
    confidence: "high",
    name: "Private Key",
  },

  // PII - Personal Identifiable Information
  {
    classification: "pii",
    pattern:
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?!\.[a-zA-Z]{2,})/g,
    confidence: "medium",
    name: "Email Address",
  },
  {
    classification: "pii",
    pattern: /(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}/g,
    confidence: "medium",
    name: "US Phone Number",
  },
  {
    classification: "pii",
    pattern: /0[789]0[-]?[0-9]{4}[-]?[0-9]{4}/g, // Japanese phone number
    confidence: "medium",
    name: "JP Phone Number",
  },
  {
    classification: "pii",
    pattern: /\d{3}[-]?\d{2}[-]?\d{4}/g, // SSN format
    confidence: "low",
    name: "Possible SSN",
  },
  {
    classification: "pii",
    pattern:
      /(?:住所|address)[\s:：]+.{10,50}(?:市|区|町|村|県|都|道|府|street|ave|road|st\.|dr\.)/gi,
    confidence: "medium",
    name: "Physical Address",
  },

  // Financial
  {
    classification: "financial",
    pattern: /(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})/g, // Credit card
    confidence: "high",
    name: "Credit Card Number",
  },
  {
    classification: "financial",
    pattern: /[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}/g, // Card format with separators
    confidence: "medium",
    name: "Possible Card Number",
  },
  {
    classification: "financial",
    pattern: /(?:口座番号|account.?number)[\s:：]*[0-9]{7,14}/gi,
    confidence: "high",
    name: "Bank Account",
  },

  // Health
  {
    classification: "health",
    pattern:
      /(?:診断|diagnosis|medical.?record|patient.?id|health.?id)[\s:：]+[a-zA-Z0-9-]{5,}/gi,
    confidence: "medium",
    name: "Medical Record",
  },
  {
    classification: "health",
    pattern:
      /(?:保険証番号|insurance.?number)[\s:：]*[a-zA-Z0-9]{8,}/gi,
    confidence: "high",
    name: "Insurance Number",
  },

  // Code/Technical
  {
    classification: "code",
    pattern: /(?:function|const|let|var|class|def|public|private)\s+\w+\s*[({]/g,
    confidence: "low",
    name: "Source Code",
  },
  {
    classification: "code",
    pattern: /(?:import|from|require)\s+['"][^'"]+['"]/g,
    confidence: "low",
    name: "Import Statement",
  },
  {
    classification: "code",
    pattern:
      /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+(?:FROM|INTO|TABLE)/gi,
    confidence: "medium",
    name: "SQL Query",
  },

  // Internal
  {
    classification: "internal",
    pattern: /(?:内部|機密|confidential|internal.?only|do.?not.?share)/gi,
    confidence: "medium",
    name: "Confidential Marker",
  },
  {
    classification: "internal",
    pattern: /(?:社内|proprietary|trade.?secret)/gi,
    confidence: "medium",
    name: "Proprietary Info",
  },
];

/**
 * Detect sensitive data in text
 */
export function detectSensitiveData(text: string): SensitiveDataResult[] {
  const results: SensitiveDataResult[] = [];

  for (const { classification, pattern, confidence, name } of PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      results.push({
        classification,
        confidence,
        pattern: name,
        matchedText: maskSensitiveText(match[0]),
        position: match.index,
      });
    }
  }

  return results;
}

/**
 * Check if text contains any sensitive data
 */
export function hasSensitiveData(text: string): boolean {
  for (const { pattern } of PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Get highest risk classification from detected data
 */
export function getHighestRiskClassification(
  results: SensitiveDataResult[]
): DataClassification | null {
  if (results.length === 0) return null;

  const priority: Record<DataClassification, number> = {
    credentials: 7,
    financial: 6,
    health: 5,
    pii: 4,
    internal: 3,
    code: 2,
    unknown: 1,
  };

  return results.reduce((highest, result) => {
    if (
      !highest ||
      priority[result.classification] > priority[highest.classification]
    ) {
      return result;
    }
    return highest;
  }, results[0]).classification;
}

/**
 * Mask sensitive text for display
 */
function maskSensitiveText(text: string): string {
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
 * Get summary of sensitive data types found
 */
export function getSensitiveDataSummary(
  results: SensitiveDataResult[]
): Record<DataClassification, number> {
  const summary: Record<DataClassification, number> = {
    credentials: 0,
    pii: 0,
    financial: 0,
    health: 0,
    code: 0,
    internal: 0,
    unknown: 0,
  };

  for (const result of results) {
    summary[result.classification]++;
  }

  return summary;
}
