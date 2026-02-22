/**
 * Network Monitor - DNR Manager
 *
 * declarativeNetRequest API を使用した Service Worker からのリクエスト補完
 * Chrome 111+ で利用可能
 */

import type { NetworkRequestRecord } from "../storage-types.js";
import { createLogger } from "../logger.js";
import { state, ensureConfigCachesCurrent } from "./state.js";
import {
  EXTENSION_ID_PATTERN,
  DNR_RULE_ID_BASE,
  DNR_RULE_ID_MAX,
  DNR_RESOURCE_TYPES,
  DNR_QUOTA_INTERVAL_MS,
  DNR_MAX_CALLS_PER_INTERVAL,
  DNR_MIN_INTERVAL_MS,
} from "./constants.js";
import { emitRecord, extractDomain } from "./web-request.js";

const logger = createLogger("network-monitor");

/**
 * ルールIDがモニター用かどうかを判定
 */
export function isMonitorRuleId(ruleId: number): boolean {
  return ruleId >= DNR_RULE_ID_BASE && ruleId < DNR_RULE_ID_MAX;
}

/**
 * DNRルールを作成
 */
export function createDNRRule(
  extensionId: string,
  ruleId: number
): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
    },
    condition: {
      initiatorDomains: [extensionId],
      resourceTypes: DNR_RESOURCE_TYPES,
    },
  };
}

/**
 * DNR APIのレート制限をチェック
 */
export function canCheckDNRMatches(now: number): boolean {
  if (now - state.dnrQuotaWindowStart >= DNR_QUOTA_INTERVAL_MS) {
    state.dnrQuotaWindowStart = now;
    state.dnrCallCount = 0;
  }

  if (state.dnrCallCount >= DNR_MAX_CALLS_PER_INTERVAL) {
    return false;
  }

  if (now - state.lastDNRCallTime < DNR_MIN_INTERVAL_MS) {
    return false;
  }

  state.lastDNRCallTime = now;
  state.dnrCallCount++;
  return true;
}

/**
 * 拡張機能IDからルールIDを検索
 */
export function findRuleIdByExtensionId(extensionId: string): number | null {
  for (const [ruleId, mappedExtensionId] of state.dnrRuleToExtensionMap.entries()) {
    if (mappedExtensionId === extensionId) {
      return ruleId;
    }
  }
  return null;
}

/**
 * 次に利用可能なルールIDを取得
 */
export function nextAvailableRuleId(): number | null {
  const usedRuleIds = new Set(state.dnrRuleToExtensionMap.keys());
  for (let ruleId = DNR_RULE_ID_BASE; ruleId < DNR_RULE_ID_MAX; ruleId++) {
    if (!usedRuleIds.has(ruleId)) {
      return ruleId;
    }
  }
  return null;
}

/**
 * DNRルールを登録
 */
export async function registerDNRRulesForExtensions(
  extensionIds: string[]
): Promise<void> {
  if (extensionIds.length === 0) {
    logger.debug("No extensions to monitor with DNR");
    return;
  }

  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((rule) => isMonitorRuleId(rule.id))
      .map((rule) => rule.id);

    const targetExtensions = extensionIds.slice(0, DNR_RULE_ID_MAX - DNR_RULE_ID_BASE);
    const nextRuleMap = new Map<number, string>();
    const newRules = targetExtensions.map((extensionId, index) => {
      const ruleId = DNR_RULE_ID_BASE + index;
      nextRuleMap.set(ruleId, extensionId);
      return createDNRRule(extensionId, ruleId);
    });

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: newRules,
    });

    state.dnrRuleToExtensionMap = nextRuleMap;
    state.dnrRulesRegistered = true;
    logger.info(`DNR rules registered for ${newRules.length} extensions`);
  } catch (error) {
    logger.error("Failed to register DNR rules:", error);
  }
}

/**
 * DNRマッチルールをチェック
 */
/**
 * webRequestで既に検出済みか判定
 *
 * DNRのチェック間隔(35秒+)内にwebRequestで同じ(extensionId, tabId)の
 * リクエストが検出されていれば、DNRのマッチは重複とみなす
 */
function isAlreadyCoveredByWebRequest(extensionId: string, tabId: number, since: number): boolean {
  const key = `${extensionId}:${tabId}`;
  const lastSeen = state.recentWebRequestHits.get(key);
  return lastSeen != null && lastSeen >= since;
}

/**
 * recentWebRequestHitsから古いエントリを除去
 */
function pruneRecentWebRequestHits(cutoff: number): void {
  for (const [key, timestamp] of state.recentWebRequestHits) {
    if (timestamp < cutoff) {
      state.recentWebRequestHits.delete(key);
    }
  }
}

/**
 * tabIdからページURLを取得（ベストエフォート）
 */
async function resolveTabUrl(tabId: number): Promise<string | null> {
  if (tabId < 0) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url ?? null;
  } catch {
    return null;
  }
}

export async function checkMatchedDNRRules(): Promise<NetworkRequestRecord[]> {
  ensureConfigCachesCurrent();

  if (!state.dnrRulesRegistered || !state.config.enabled) {
    return [];
  }

  const now = Date.now();
  if (!canCheckDNRMatches(now)) {
    return [];
  }

  const checkWindow = state.lastMatchedRulesCheck;

  try {
    const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({
      minTimeStamp: checkWindow,
    });

    state.lastMatchedRulesCheck = now;
    const cutoff = Math.max(checkWindow, now - DNR_QUOTA_INTERVAL_MS);
    pruneRecentWebRequestHits(cutoff);

    const records: NetworkRequestRecord[] = [];
    const tabUrlCache = new Map<number, string | null>();

    for (const info of matchedRules.rulesMatchedInfo) {
      const ruleId = info.rule.ruleId;
      if (!isMonitorRuleId(ruleId)) {
        continue;
      }

      const extensionId = state.dnrRuleToExtensionMap.get(ruleId);
      if (!extensionId) continue;
      if (state.excludedExtensions.has(extensionId)) continue;

      if (isAlreadyCoveredByWebRequest(extensionId, info.tabId, checkWindow)) {
        continue;
      }

      const extInfo = state.knownExtensions.get(extensionId);

      let tabUrl: string | null;
      if (tabUrlCache.has(info.tabId)) {
        tabUrl = tabUrlCache.get(info.tabId) ?? null;
      } else {
        tabUrl = await resolveTabUrl(info.tabId);
        tabUrlCache.set(info.tabId, tabUrl);
      }

      const record: NetworkRequestRecord = {
        id: crypto.randomUUID(),
        timestamp: info.timeStamp,
        url: tabUrl ?? `[DNR detected - tabId: ${info.tabId}]`,
        method: "UNKNOWN",
        domain: tabUrl ? extractDomain(tabUrl) : "unknown",
        resourceType: "xmlhttprequest",
        initiator: `chrome-extension://${extensionId}`,
        initiatorType: "extension",
        extensionId,
        extensionName: extInfo?.name,
        tabId: info.tabId,
        frameId: 0,
        detectedBy: "declarativeNetRequest",
      };

      records.push(record);
      emitRecord(record);
    }

    if (records.length > 0) {
      logger.info(`DNR supplemental: ${records.length} requests not seen by webRequest`);
    }

    return records;
  } catch (error) {
    const errorMessage = String(error);
    if (errorMessage.includes("quota") || errorMessage.includes("QUOTA")) {
      logger.warn("DNR quota exceeded, entering backoff mode");
      state.dnrCallCount = DNR_MAX_CALLS_PER_INTERVAL;
      return [];
    }
    logger.error("Failed to check matched DNR rules:", error);
    return [];
  }
}

/**
 * DNRルールをクリア
 */
export async function clearDNRRules(): Promise<void> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules
      .filter((rule) => isMonitorRuleId(rule.id))
      .map((rule) => rule.id);

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove,
      });
    }

    state.dnrRulesRegistered = false;
    state.dnrRuleToExtensionMap.clear();
    logger.debug("DNR rules cleared");
  } catch (error) {
    logger.error("Failed to clear DNR rules:", error);
  }
}

/**
 * 単一の拡張機能のDNRルールを追加
 */
export async function addDNRRuleForExtension(extensionId: string): Promise<void> {
  if (!extensionId || !EXTENSION_ID_PATTERN.test(extensionId)) {
    logger.warn(`Invalid extension ID format: ${extensionId}`);
    return;
  }

  try {
    if (findRuleIdByExtensionId(extensionId) !== null) {
      return;
    }

    const ruleId = nextAvailableRuleId();
    if (ruleId === null) {
      logger.warn(`Cannot add DNR rule for ${extensionId}: no available rule ID`);
      return;
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [createDNRRule(extensionId, ruleId)],
    });
    state.dnrRuleToExtensionMap.set(ruleId, extensionId);
    logger.info(`DNR rule ${ruleId} added for extension ${extensionId}`);
  } catch (error) {
    logger.error(`Failed to add DNR rule for ${extensionId}:`, error);
  }
}

/**
 * 拡張機能のDNRルールを削除
 */
export async function removeDNRRuleForExtension(
  extensionId: string
): Promise<void> {
  try {
    const ruleIdToRemove = findRuleIdByExtensionId(extensionId);
    if (ruleIdToRemove === null) return;

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleIdToRemove],
    });
    state.dnrRuleToExtensionMap.delete(ruleIdToRemove);
    logger.info(`DNR rule ${ruleIdToRemove} removed for extension ${extensionId}`);
  } catch (error) {
    logger.error(`Failed to remove DNR rule for ${extensionId}:`, error);
  }
}

/**
 * DNRマッピングを復元
 */
export async function restoreDNRMapping(): Promise<boolean> {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const relevantRules = existingRules.filter((rule) =>
      isMonitorRuleId(rule.id)
    );

    state.dnrRuleToExtensionMap.clear();
    let needsReconciliation = false;
    for (const rule of relevantRules) {
      if (rule.condition?.initiatorDomains?.length === 1) {
        const extensionId = rule.condition.initiatorDomains[0];
        if (!EXTENSION_ID_PATTERN.test(extensionId)) {
          needsReconciliation = true;
          continue;
        }

        if (
          (state.config.excludeOwnExtension &&
            extensionId === state.ownExtensionId) ||
          state.excludedExtensions.has(extensionId)
        ) {
          needsReconciliation = true;
          continue;
        }

        state.dnrRuleToExtensionMap.set(rule.id, extensionId);
        continue;
      }

      needsReconciliation = true;
    }

    state.dnrRulesRegistered = state.dnrRuleToExtensionMap.size > 0;
    logger.info(`DNR mapping restored: ${state.dnrRuleToExtensionMap.size} rules`);
    return needsReconciliation;
  } catch (error) {
    logger.error("Failed to restore DNR mapping:", error);
    return true;
  }
}
