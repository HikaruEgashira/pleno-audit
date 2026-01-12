import { useState, useEffect, useMemo } from "preact/hooks";
import { useTheme } from "../../../lib/theme";
import { Badge } from "../../../components";

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

interface GroupedExtension {
  id: string;
  name: string;
  requestCount: number;
  domains: { domain: string; count: number }[];
  icon?: string;
}

export function ExtensionsTab() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<ExtensionStats | null>(null);
  const [extensions, setExtensions] = useState<Record<string, ExtensionInfo>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsResult, extResult, allExtensions] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATS" }),
        chrome.runtime.sendMessage({ type: "GET_KNOWN_EXTENSIONS" }),
        chrome.management.getAll(),
      ]);
      setStats(statsResult || null);

      // 既知の拡張機能とmanagement APIの結果をマージ
      const extMap: Record<string, ExtensionInfo> = extResult || {};
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
      setExtensions(extMap);
    } catch (error) {
      console.error("Failed to load extension stats:", error);
    } finally {
      setLoading(false);
    }
  }

  const groupedExtensions = useMemo((): GroupedExtension[] => {
    // ドメインごとのリクエスト数を計算するために、byDomainを使用
    const domainCounts: Record<string, Record<string, number>> = {};

    // byExtensionとbyDomainを組み合わせて、拡張機能ごとのドメイン別カウントを推定
    if (stats) {
      for (const [extId, extData] of Object.entries(stats.byExtension)) {
        domainCounts[extId] = {};
        for (const domain of extData.domains) {
          // ドメインのリクエスト数を拡張機能数で按分（概算）
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

    // 全ての拡張機能を含める（リクエスト0も表示）
    return Object.entries(extensions)
      .map(([id, ext]) => {
        const statData = stats?.byExtension[id];
        const icon = ext.icons?.find((ic) => ic.size >= 16)?.url || ext.icons?.[0]?.url;

        const domains = (statData?.domains || [])
          .map((domain) => ({
            domain,
            count: domainCounts[id]?.[domain] || 1,
          }))
          .sort((a, b) => b.count - a.count);

        return {
          id,
          name: ext.name,
          requestCount: statData?.count || 0,
          domains,
          icon,
        };
      })
      .sort((a, b) => b.requestCount - a.requestCount);
  }, [stats, extensions]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "8px",
    },
    header: {
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
      marginBottom: "4px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "16px",
    },
    extensionItem: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      overflow: "hidden",
    },
    extensionHeader: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    extensionHeaderHover: {
      background: colors.bgSecondary,
    },
    chevron: {
      fontSize: "10px",
      color: colors.textSecondary,
      transition: "transform 0.2s",
      width: "16px",
      textAlign: "center" as const,
    },
    chevronExpanded: {
      transform: "rotate(90deg)",
    },
    icon: {
      width: "20px",
      height: "20px",
      borderRadius: "4px",
      flexShrink: 0,
    },
    iconPlaceholder: {
      width: "20px",
      height: "20px",
      borderRadius: "4px",
      background: colors.bgSecondary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "10px",
      color: colors.textSecondary,
      flexShrink: 0,
    },
    extensionName: {
      flex: 1,
      fontSize: "13px",
      color: colors.textPrimary,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    domainList: {
      borderTop: `1px solid ${colors.borderLight}`,
      background: colors.bgSecondary,
      padding: "8px 12px 8px 48px",
    },
    domainItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "4px 0",
      fontSize: "12px",
    },
    domainName: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    domainCount: {
      color: colors.textMuted,
      fontSize: "11px",
      flexShrink: 0,
      marginLeft: "8px",
    },
    summary: {
      fontSize: "11px",
      color: colors.textSecondary,
      textAlign: "center" as const,
      padding: "8px",
      borderTop: `1px solid ${colors.borderLight}`,
    },
  };

  if (loading) {
    return <p style={styles.emptyText}>読み込み中...</p>;
  }

  if (groupedExtensions.length === 0) {
    return (
      <div style={styles.container}>
        <p style={styles.emptyText}>
          他の拡張機能はインストールされていません
        </p>
      </div>
    );
  }

  const totalRequests = stats?.total || 0;
  const totalDomains = Object.keys(stats?.byDomain || {}).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>拡張機能の接続先 ({groupedExtensions.length})</span>
        <Badge size="sm">{totalRequests} リクエスト</Badge>
      </div>

      {groupedExtensions.slice(0, 10).map((ext) => {
        const isExpanded = expandedIds.has(ext.id);
        return (
          <div key={ext.id} style={styles.extensionItem}>
            <div
              style={styles.extensionHeader}
              onClick={() => toggleExpand(ext.id)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bgSecondary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <span
                style={{
                  ...styles.chevron,
                  ...(isExpanded ? styles.chevronExpanded : {}),
                }}
              >
                ▶
              </span>
              {ext.icon ? (
                <img src={ext.icon} style={styles.icon} alt="" />
              ) : (
                <div style={styles.iconPlaceholder}>?</div>
              )}
              <span style={styles.extensionName} title={ext.name}>
                {ext.name}
              </span>
              <Badge size="sm">{ext.requestCount}</Badge>
            </div>

            {isExpanded && (
              <div style={styles.domainList}>
                {ext.domains.length === 0 ? (
                  <div style={{ ...styles.domainItem, color: colors.textMuted, fontStyle: "italic" }}>
                    通信なし
                  </div>
                ) : (
                  <>
                    {ext.domains.slice(0, 10).map((d) => (
                      <div key={d.domain} style={styles.domainItem}>
                        <span style={styles.domainName} title={d.domain}>
                          {d.domain.length > 30
                            ? d.domain.substring(0, 30) + "..."
                            : d.domain}
                        </span>
                        <span style={styles.domainCount}>{d.count}</span>
                      </div>
                    ))}
                    {ext.domains.length > 10 && (
                      <div
                        style={{
                          ...styles.domainItem,
                          color: colors.textMuted,
                          fontStyle: "italic",
                        }}
                      >
                        他 {ext.domains.length - 10} ドメイン
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {groupedExtensions.length > 10 && (
        <p style={{ ...styles.emptyText, padding: "8px" }}>
          他 {groupedExtensions.length - 10} 件の拡張機能
        </p>
      )}

      <div style={styles.summary}>
        合計: {totalRequests} リクエスト / {totalDomains} ドメイン
      </div>
    </div>
  );
}
