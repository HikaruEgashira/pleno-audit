import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import {
  createPermissionAnalyzer,
  type ExtensionAnalysis,
  type PermissionSummary,
  type ExtensionManifest,
} from "@pleno-audit/permission-analyzer";
import type { ExtensionRequestRecord, ExtensionInfo } from "@pleno-audit/extension-runtime";

interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[] }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

export interface ExtensionData {
  extensions: ExtensionInfo[];
  extensionMap: Record<string, ExtensionInfo>;
  analyses: ExtensionAnalysis[];
  summary: PermissionSummary | null;
  requests: ExtensionRequestRecord[];
  stats: ExtensionStats | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useExtensionData(): ExtensionData {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [extensionMap, setExtensionMap] = useState<Record<string, ExtensionInfo>>({});
  const [analyses, setAnalyses] = useState<ExtensionAnalysis[]>([]);
  const [summary, setSummary] = useState<PermissionSummary | null>(null);
  const [requests, setRequests] = useState<ExtensionRequestRecord[]>([]);
  const [stats, setStats] = useState<ExtensionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const analyzer = useMemo(() => createPermissionAnalyzer(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqResult, extResult, statsResult] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_REQUESTS", data: { limit: 500 } }),
        chrome.runtime.sendMessage({ type: "GET_KNOWN_EXTENSIONS" }),
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATS" }),
      ]);

      setRequests(reqResult?.requests || []);
      setExtensionMap(extResult || {});
      setStats(statsResult || null);

      const allExtensions = await chrome.management.getAll();
      const extensionsList = allExtensions.filter((e) => e.type === "extension");
      setExtensions(extensionsList as unknown as ExtensionInfo[]);

      const analysisResults: ExtensionAnalysis[] = [];
      for (const ext of extensionsList) {
        const manifest: ExtensionManifest = {
          id: ext.id,
          name: ext.name,
          version: ext.version,
          permissions: ext.permissions || [],
          host_permissions: ext.hostPermissions || [],
        };
        analysisResults.push(analyzer.analyzeExtension(manifest));
      }
      analysisResults.sort((a, b) => b.riskScore - a.riskScore);
      setAnalyses(analysisResults);
      setSummary(await analyzer.getSummary());
    } catch (error) {
      console.error("Failed to load extension data:", error);
    } finally {
      setLoading(false);
    }
  }, [analyzer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    extensions,
    extensionMap,
    analyses,
    summary,
    requests,
    stats,
    loading,
    refresh: loadData,
  };
}
