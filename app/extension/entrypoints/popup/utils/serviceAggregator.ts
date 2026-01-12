import { findFaviconUrl, type DetectedService } from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DetectionConfig } from "@pleno-audit/extension-runtime";

export type ServiceTag =
  | { type: "nrd"; domainAge: number | null; confidence: string }
  | { type: "typosquat"; score: number; confidence: string }
  | { type: "ai" }
  | { type: "login" }
  | { type: "privacy"; url: string }
  | { type: "tos"; url: string }
  | { type: "cookie"; count: number };

export interface ConnectionInfo {
  domain: string;
  requestCount: number;
}

export type ServiceSource =
  | { type: "domain"; domain: string; service: DetectedService }
  | { type: "extension"; extensionId: string; extensionName: string; icon?: string };

export interface UnifiedService {
  id: string;
  source: ServiceSource;
  connections: ConnectionInfo[];
  tags: ServiceTag[];
  lastActivity: number;
  faviconUrl?: string;
}

export type SortType = "activity" | "connections" | "name";

export function sortServices(
  services: UnifiedService[],
  sortType: SortType
): UnifiedService[] {
  return [...services].sort((a, b) => {
    switch (sortType) {
      case "activity":
        return b.lastActivity - a.lastActivity;
      case "connections": {
        const aCount = a.connections.reduce((sum, c) => sum + c.requestCount, 0);
        const bCount = b.connections.reduce((sum, c) => sum + c.requestCount, 0);
        if (bCount !== aCount) return bCount - aCount;
        return b.lastActivity - a.lastActivity;
      }
      case "name": {
        const aName = a.source.type === "domain" ? a.source.domain : a.source.extensionName;
        const bName = b.source.type === "domain" ? b.source.domain : b.source.extensionName;
        return aName.localeCompare(bName);
      }
      default:
        return 0;
    }
  });
}

interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[] }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons?: { size: number; url: string }[];
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function extractTags(service: DetectedService, config: DetectionConfig): ServiceTag[] {
  const tags: ServiceTag[] = [];

  if (config.enableNRD && service.nrdResult?.isNRD) {
    tags.push({
      type: "nrd",
      domainAge: service.nrdResult.domainAge,
      confidence: service.nrdResult.confidence,
    });
  }

  if (config.enableTyposquat && service.typosquatResult?.isTyposquat) {
    tags.push({
      type: "typosquat",
      score: service.typosquatResult.totalScore,
      confidence: service.typosquatResult.confidence,
    });
  }

  if (config.enableAI && service.aiDetected?.hasAIActivity) {
    tags.push({ type: "ai" });
  }

  if (config.enableLogin && service.hasLoginPage) {
    tags.push({ type: "login" });
  }

  if (config.enablePrivacy && service.privacyPolicyUrl) {
    tags.push({ type: "privacy", url: service.privacyPolicyUrl });
  }

  if (config.enableTos && service.termsOfServiceUrl) {
    tags.push({ type: "tos", url: service.termsOfServiceUrl });
  }

  if (service.cookies.length > 0) {
    tags.push({ type: "cookie", count: service.cookies.length });
  }

  return tags;
}

function getConnectionsForDomain(
  sourceDomain: string,
  networkRequests: NetworkRequest[],
  violations: CSPViolation[]
): ConnectionInfo[] {
  const connectionMap = new Map<string, number>();

  // NetworkRequestsから接続先を集計
  // initiatorはリクエスト種別（"fetch", "xhr"等）なのでpageUrlを使用
  for (const req of networkRequests) {
    const pageDomain = extractDomain(req.pageUrl);
    if (pageDomain === sourceDomain) {
      const targetDomain = req.domain;
      if (targetDomain && targetDomain !== sourceDomain) {
        connectionMap.set(targetDomain, (connectionMap.get(targetDomain) || 0) + 1);
      }
    }
  }

  // CSP違反から接続先を集計
  for (const v of violations) {
    const sourceDomainFromViolation = extractDomain(v.pageUrl);
    if (sourceDomainFromViolation === sourceDomain) {
      const targetDomain = extractDomain(v.blockedURL);
      if (targetDomain && targetDomain !== sourceDomain) {
        connectionMap.set(targetDomain, (connectionMap.get(targetDomain) || 0) + 1);
      }
    }
  }

  return Array.from(connectionMap.entries())
    .map(([domain, requestCount]) => ({ domain, requestCount }))
    .sort((a, b) => b.requestCount - a.requestCount);
}

export async function aggregateServices(
  services: DetectedService[],
  networkRequests: NetworkRequest[],
  violations: CSPViolation[],
  config: DetectionConfig
): Promise<UnifiedService[]> {
  const result: UnifiedService[] = [];

  // 1. DetectedServiceをUnifiedServiceに変換
  for (const service of services) {
    const connections = getConnectionsForDomain(
      service.domain,
      networkRequests,
      violations
    );

    result.push({
      id: `domain:${service.domain}`,
      source: { type: "domain", domain: service.domain, service },
      connections,
      tags: extractTags(service, config),
      lastActivity: service.detectedAt,
      // DetectedServiceのfaviconUrlを優先、なければNetworkRequestsから検索
      faviconUrl: service.faviconUrl || findFaviconUrl(service.domain, networkRequests),
    });
  }

  // 2. 拡張機能を追加
  try {
    const [statsResult, extResult, allExtensions] = await Promise.all([
      chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATS" }),
      chrome.runtime.sendMessage({ type: "GET_KNOWN_EXTENSIONS" }),
      chrome.management.getAll(),
    ]);

    const stats: ExtensionStats | null = statsResult || null;
    const extMap: Record<string, ExtensionInfo> = extResult || {};

    // 既知の拡張機能とmanagement APIの結果をマージ
    for (const ext of allExtensions) {
      if (ext.type === "extension" && ext.id !== chrome.runtime.id) {
        if (!extMap[ext.id]) {
          extMap[ext.id] = {
            id: ext.id,
            name: ext.name,
            version: ext.version,
            enabled: ext.enabled,
            icons: ext.icons,
          };
        }
      }
    }

    // 拡張機能ごとのドメイン別カウントを計算
    const domainCounts: Record<string, Record<string, number>> = {};
    if (stats) {
      for (const [extId, extData] of Object.entries(stats.byExtension)) {
        domainCounts[extId] = {};
        for (const domain of extData.domains) {
          const domainInfo = stats.byDomain[domain];
          if (domainInfo) {
            const share = Math.ceil(domainInfo.count / domainInfo.extensions.length);
            domainCounts[extId][domain] = share;
          } else {
            domainCounts[extId][domain] = 1;
          }
        }
      }
    }

    // 拡張機能をUnifiedServiceに変換
    for (const [id, ext] of Object.entries(extMap)) {
      const statData = stats?.byExtension[id];
      const icon = ext.icons?.find((ic) => ic.size >= 16)?.url || ext.icons?.[0]?.url;

      const connections = (statData?.domains || [])
        .map((domain) => ({
          domain,
          requestCount: domainCounts[id]?.[domain] || 1,
        }))
        .sort((a, b) => b.requestCount - a.requestCount);

      // 拡張機能のlastActivityは、接続があればその存在を示す適度な値、なければ0
      const lastActivity = connections.length > 0 ? Date.now() - 60000 : 0;

      result.push({
        id: `extension:${id}`,
        source: { type: "extension", extensionId: id, extensionName: ext.name, icon },
        connections,
        tags: [],
        lastActivity,
      });
    }
  } catch (error) {
    console.error("Failed to load extension data:", error);
  }

  return result;
}
