import { useState, useEffect } from "preact/hooks";
import type { ExtensionMonitorConfig } from "@pleno-audit/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { sendMessage } from "../utils/messaging";

interface DNROption {
  key: keyof Pick<ExtensionMonitorConfig, "enabled" | "excludeOwnExtension">;
  label: string;
  description: string;
}

const DNR_OPTIONS: DNROption[] = [
  { key: "enabled", label: "拡張機能監視", description: "拡張機能の通信を監視" },
  { key: "excludeOwnExtension", label: "自身を除外", description: "Pleno Auditを除外" },
];

export function DNRSettings() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<ExtensionMonitorConfig | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    sendMessage<ExtensionMonitorConfig>({ type: "GET_EXTENSION_MONITOR_CONFIG" })
      .then(setConfig)
      .catch(() => {});
  }, []);

  function handleToggle(key: DNROption["key"]) {
    if (!config) return;
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    sendMessage({
      type: "SET_EXTENSION_MONITOR_CONFIG",
      data: newConfig,
    }).catch(() => {});
  }

  const styles = {
    container: {
      marginTop: "12px",
      borderTop: `1px solid ${colors.border}`,
      paddingTop: "12px",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      padding: "4px 0",
    },
    title: {
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
    },
    chevron: {
      fontSize: "10px",
      color: colors.textSecondary,
      transition: "transform 0.2s",
      transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    },
    content: {
      marginTop: "8px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "6px",
    },
    option: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 8px",
      background: colors.bgSecondary,
      borderRadius: "6px",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    checkbox: {
      width: "14px",
      height: "14px",
      accentColor: colors.accent,
    },
    labelContainer: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "1px",
    },
    label: {
      fontSize: "11px",
      fontWeight: 500,
      color: colors.textPrimary,
    },
    description: {
      fontSize: "9px",
      color: colors.textMuted,
    },
  };

  if (!config) return null;

  const enabledCount = DNR_OPTIONS.filter(opt => config[opt.key]).length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          DNR設定 ({enabledCount}/{DNR_OPTIONS.length})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <div style={styles.content}>
          {DNR_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              style={styles.option}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bgTertiary || colors.border;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bgSecondary;
              }}
            >
              <input
                type="checkbox"
                checked={config[opt.key]}
                onChange={() => handleToggle(opt.key)}
                style={styles.checkbox}
              />
              <div style={styles.labelContainer}>
                <span style={styles.label}>{opt.label}</span>
                <span style={styles.description}>{opt.description}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
