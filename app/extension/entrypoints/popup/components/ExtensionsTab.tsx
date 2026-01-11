import { useState, useEffect } from "preact/hooks";
import { useTheme } from "../../../lib/theme";
import { Badge } from "../../../components";

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons?: { size: number; url: string }[];
}

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

export function ExtensionsTab() {
  const { colors } = useTheme();
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const allExtensions = await chrome.management.getAll();
      const filtered = allExtensions
        .filter((ext) => ext.type === "extension" && ext.id !== chrome.runtime.id)
        .map((ext) => ({
          id: ext.id,
          name: ext.name,
          version: ext.version,
          enabled: ext.enabled,
          icons: ext.icons,
        }))
        .sort((a, b) => {
          if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      setExtensions(filtered);
    } catch (error) {
      console.error("Failed to load extensions:", error);
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
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      borderBottom: `1px solid ${colors.borderLight}`,
    },
    itemLast: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
    },
    icon: {
      width: "24px",
      height: "24px",
      borderRadius: "4px",
      flexShrink: 0,
    },
    iconPlaceholder: {
      width: "24px",
      height: "24px",
      borderRadius: "4px",
      background: colors.bgSecondary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      color: colors.textSecondary,
      flexShrink: 0,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: "13px",
      color: colors.textPrimary,
      whiteSpace: "nowrap" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    version: {
      fontSize: "11px",
      color: colors.textSecondary,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "16px",
    },
    summary: {
      fontSize: "11px",
      color: colors.textSecondary,
      marginTop: "8px",
      paddingTop: "8px",
      borderTop: `1px solid ${colors.borderLight}`,
    },
  };

  if (loading) {
    return <p style={styles.emptyText}>読み込み中...</p>;
  }

  const enabledCount = extensions.filter((e) => e.enabled).length;
  const disabledCount = extensions.length - enabledCount;

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>インストール済み拡張機能 ({extensions.length})</div>
        {extensions.length === 0 ? (
          <p style={styles.emptyText}>拡張機能なし</p>
        ) : (
          <>
            {extensions.slice(0, 10).map((ext, i) => {
              const icon = ext.icons?.find((ic) => ic.size >= 24) || ext.icons?.[0];
              return (
                <div
                  key={ext.id}
                  style={i === Math.min(extensions.length, 10) - 1 ? styles.itemLast : styles.item}
                >
                  {icon ? (
                    <img src={icon.url} style={styles.icon} alt="" />
                  ) : (
                    <div style={styles.iconPlaceholder}>?</div>
                  )}
                  <div style={styles.info}>
                    <div style={styles.name}>{truncate(ext.name, 25)}</div>
                    <div style={styles.version}>v{ext.version}</div>
                  </div>
                  <Badge variant={ext.enabled ? "success" : "secondary"} size="sm">
                    {ext.enabled ? "有効" : "無効"}
                  </Badge>
                </div>
              );
            })}
            {extensions.length > 10 && (
              <p style={{ ...styles.emptyText, padding: "8px" }}>
                他 {extensions.length - 10} 件
              </p>
            )}
          </>
        )}
        <div style={styles.summary}>
          有効: {enabledCount} / 無効: {disabledCount}
        </div>
      </div>
    </div>
  );
}
