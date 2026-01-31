/**
 * @fileoverview Blocking Engine
 *
 * Policy Enforcement Point (PEP) blocking functionality.
 * User consent based, default disabled.
 */

import type { BlockingConfig } from "./blocking-types.js";
import { DEFAULT_BLOCKING_CONFIG } from "./blocking-types.js";
import { createLogger } from "@pleno-audit/runtime-platform";

const logger = createLogger("blocking-engine");

// ============================================================================
// Types
// ============================================================================

/**
 * Block target type
 */
export type BlockTarget =
  | "typosquat"
  | "nrd_login"
  | "high_risk_extension"
  | "sensitive_data_ai";

/**
 * Block decision result
 */
export interface BlockDecision {
  shouldBlock: boolean;
  target: BlockTarget;
  reason: string;
  domain?: string;
  details?: Record<string, unknown>;
}

/**
 * Block event
 */
export interface BlockEvent {
  id: string;
  timestamp: number;
  target: BlockTarget;
  decision: "blocked" | "warned" | "allowed";
  domain: string;
  reason: string;
  userOverride?: boolean;
}

// ============================================================================
// Blocking Engine
// ============================================================================

/**
 * Create blocking engine
 */
export function createBlockingEngine(
  initialConfig: BlockingConfig = DEFAULT_BLOCKING_CONFIG
) {
  let config = { ...initialConfig };
  const blockEvents: BlockEvent[] = [];
  const maxEvents = 1000;

  function updateConfig(updates: Partial<BlockingConfig>): void {
    config = { ...config, ...updates };
    logger.info("Blocking config updated", { enabled: config.enabled });
  }

  function getConfig(): BlockingConfig {
    return { ...config };
  }

  function isEnabled(): boolean {
    return config.enabled && config.userConsentGiven;
  }

  function recordConsent(): void {
    config.userConsentGiven = true;
    config.consentTimestamp = Date.now();
    logger.info("User consent recorded for blocking");
  }

  function checkTyposquat(params: {
    domain: string;
    confidence: "high" | "medium" | "low" | "none";
  }): BlockDecision {
    if (!isEnabled() || !config.blockTyposquat) {
      return {
        shouldBlock: false,
        target: "typosquat",
        reason: "Blocking disabled",
        domain: params.domain,
      };
    }

    if (params.confidence === "high" || params.confidence === "medium") {
      recordBlockEvent({
        target: "typosquat",
        decision: "blocked",
        domain: params.domain,
        reason: `Typosquatting detected (${params.confidence} confidence)`,
      });

      return {
        shouldBlock: true,
        target: "typosquat",
        reason: `タイポスクワット検出: ${params.domain}`,
        domain: params.domain,
        details: { confidence: params.confidence },
      };
    }

    return {
      shouldBlock: false,
      target: "typosquat",
      reason: "Low confidence, not blocked",
      domain: params.domain,
    };
  }

  function checkNRDLogin(params: {
    domain: string;
    isNRD: boolean;
    hasLoginForm: boolean;
  }): BlockDecision {
    if (!isEnabled() || !config.blockNRDLogin) {
      return {
        shouldBlock: false,
        target: "nrd_login",
        reason: "Blocking disabled",
        domain: params.domain,
      };
    }

    if (params.isNRD && params.hasLoginForm) {
      recordBlockEvent({
        target: "nrd_login",
        decision: "warned",
        domain: params.domain,
        reason: "Login on NRD detected",
      });

      return {
        shouldBlock: true,
        target: "nrd_login",
        reason: `新規登録ドメインでのログイン: ${params.domain}`,
        domain: params.domain,
        details: { isNRD: true, hasLoginForm: true },
      };
    }

    return {
      shouldBlock: false,
      target: "nrd_login",
      reason: "Not an NRD login",
      domain: params.domain,
    };
  }

  function checkHighRiskExtension(params: {
    extensionId: string;
    extensionName: string;
    riskScore: number;
    riskLevel: string;
  }): BlockDecision {
    if (!isEnabled() || !config.blockHighRiskExtension) {
      return {
        shouldBlock: false,
        target: "high_risk_extension",
        reason: "Blocking disabled",
        domain: `chrome-extension://${params.extensionId}`,
      };
    }

    if (params.riskLevel === "critical" || params.riskScore >= 80) {
      recordBlockEvent({
        target: "high_risk_extension",
        decision: "blocked",
        domain: `chrome-extension://${params.extensionId}`,
        reason: `High risk extension: ${params.extensionName}`,
      });

      return {
        shouldBlock: true,
        target: "high_risk_extension",
        reason: `高リスク拡張機能: ${params.extensionName}`,
        domain: `chrome-extension://${params.extensionId}`,
        details: {
          extensionId: params.extensionId,
          riskScore: params.riskScore,
          riskLevel: params.riskLevel,
        },
      };
    }

    return {
      shouldBlock: false,
      target: "high_risk_extension",
      reason: "Risk level acceptable",
      domain: `chrome-extension://${params.extensionId}`,
    };
  }

  function checkSensitiveDataToAI(params: {
    domain: string;
    provider: string;
    hasCredentials: boolean;
    hasFinancial: boolean;
    hasPII: boolean;
    riskLevel: string;
  }): BlockDecision {
    if (!isEnabled() || !config.blockSensitiveDataToAI) {
      return {
        shouldBlock: false,
        target: "sensitive_data_ai",
        reason: "Blocking disabled",
        domain: params.domain,
      };
    }

    if (params.hasCredentials) {
      recordBlockEvent({
        target: "sensitive_data_ai",
        decision: "blocked",
        domain: params.domain,
        reason: "Credentials detected in AI prompt",
      });

      return {
        shouldBlock: true,
        target: "sensitive_data_ai",
        reason: "AIへの資格情報送信をブロック",
        domain: params.domain,
        details: {
          provider: params.provider,
          dataTypes: ["credentials"],
        },
      };
    }

    if (params.hasFinancial) {
      recordBlockEvent({
        target: "sensitive_data_ai",
        decision: "warned",
        domain: params.domain,
        reason: "Financial data detected in AI prompt",
      });

      return {
        shouldBlock: true,
        target: "sensitive_data_ai",
        reason: "AIへの金融情報送信を警告",
        domain: params.domain,
        details: {
          provider: params.provider,
          dataTypes: ["financial"],
        },
      };
    }

    return {
      shouldBlock: false,
      target: "sensitive_data_ai",
      reason: "No sensitive data detected",
      domain: params.domain,
    };
  }

  function recordBlockEvent(event: Omit<BlockEvent, "id" | "timestamp">): void {
    const blockEvent: BlockEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...event,
    };

    blockEvents.unshift(blockEvent);

    if (blockEvents.length > maxEvents) {
      blockEvents.splice(maxEvents);
    }

    logger.info("Block event recorded", {
      target: event.target,
      decision: event.decision,
      domain: event.domain,
    });
  }

  function getBlockEvents(options?: {
    limit?: number;
    target?: BlockTarget;
  }): BlockEvent[] {
    let result = [...blockEvents];

    if (options?.target) {
      result = result.filter((e) => e.target === options.target);
    }

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  function getStats(): {
    totalBlocked: number;
    totalWarned: number;
    totalAllowed: number;
    byTarget: Record<BlockTarget, number>;
  } {
    const stats = {
      totalBlocked: 0,
      totalWarned: 0,
      totalAllowed: 0,
      byTarget: {
        typosquat: 0,
        nrd_login: 0,
        high_risk_extension: 0,
        sensitive_data_ai: 0,
      } as Record<BlockTarget, number>,
    };

    for (const event of blockEvents) {
      if (event.decision === "blocked") stats.totalBlocked++;
      else if (event.decision === "warned") stats.totalWarned++;
      else stats.totalAllowed++;

      stats.byTarget[event.target]++;
    }

    return stats;
  }

  function clearEvents(): void {
    blockEvents.length = 0;
  }

  return {
    updateConfig,
    getConfig,
    isEnabled,
    recordConsent,
    checkTyposquat,
    checkNRDLogin,
    checkHighRiskExtension,
    checkSensitiveDataToAI,
    getBlockEvents,
    getStats,
    clearEvents,
  };
}

export type BlockingEngine = ReturnType<typeof createBlockingEngine>;
