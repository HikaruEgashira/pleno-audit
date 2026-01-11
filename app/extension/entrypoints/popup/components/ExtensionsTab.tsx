import { useState, useEffect } from "preact/hooks";
import { useTheme } from "../../../lib/theme";
import { Badge } from "../../../components";
import type { ExtensionRequestRecord } from "@pleno-audit/extension-runtime";

interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[] }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

export function ExtensionsTab() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<ExtensionStats | null>(null);
  const [requests, setRequests] = useState<ExtensionRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsResult, reqResult] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATS" }),
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_REQUESTS", data: { limit: 10 } }),
      ]);
      setStats(statsResult || null);
      setRequests(reqResult?.requests || []);
    } catch (error) {
      console.error("Failed to load extension data:", error);
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "12px",
    },
    section: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "12px",
    },
    sectionTitle: {
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
      marginBottom: "8px",
    },
    item: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
      borderBottom: `1px solid ${colors.borderLight}`,
    },
    itemLast: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
    },
    name: {
      fontSize: "13px",
      color: colors.textPrimary,
    },
    domain: {
      fontSize: "11px",
      color: colors.textSecondary,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "16px",
    },
    recentItem: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "2px",
      padding: "6px 0",
      borderBottom: `1px solid ${colors.borderLight}`,
    },
    recentHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    recentUrl: {
      fontSize: "11px",
      color: colors.textSecondary,
      wordBreak: "break-all" as const,
    },
  };

  if (loading) {
    return <p style={styles.emptyText}>読み込み中...</p>;
  }

  const extensionList = stats
    ? Object.entries(stats.byExtension)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    : [];

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>拡張機能別リクエスト数</div>
        {extensionList.length === 0 ? (
          <p style={styles.emptyText}>データなし</p>
        ) : (
          extensionList.map((ext, i) => (
            <div
              key={ext.id}
              style={i === extensionList.length - 1 ? styles.itemLast : styles.item}
            >
              <span style={styles.name}>{truncate(ext.name, 20)}</span>
              <Badge>{ext.count}</Badge>
            </div>
          ))
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>最近のリクエスト</div>
        {requests.length === 0 ? (
          <p style={styles.emptyText}>データなし</p>
        ) : (
          requests.slice(0, 5).map((req, i) => (
            <div
              key={req.id}
              style={{
                ...styles.recentItem,
                borderBottom: i === 4 ? "none" : styles.recentItem.borderBottom,
              }}
            >
              <div style={styles.recentHeader}>
                <span style={styles.name}>{truncate(req.extensionName, 15)}</span>
                <Badge>{req.resourceType}</Badge>
              </div>
              <span style={styles.recentUrl}>{truncate(req.domain, 30)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
