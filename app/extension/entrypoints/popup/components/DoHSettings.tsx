import { useState, useEffect } from "preact/hooks";
import type { DoHMonitorConfig, DoHAction } from "@pleno-audit/extension-runtime";
import { useTheme } from "../../../lib/theme";

interface ActionOption {
  value: DoHAction;
  label: string;
  description: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  { value: "detect", label: "検出のみ", description: "通知なし" },
  { value: "alert", label: "通知", description: "検出時に通知" },
  { value: "block", label: "ブロック", description: "DoH通信をブロック" },
];

export function DoHSettings() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<DoHMonitorConfig | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_DOH_MONITOR_CONFIG" })
      .then((cfg) => setConfig(cfg))
      .catch(() => {});
  }, []);

  function handleActionChange(action: DoHAction) {
    if (!config) return;
    const newConfig = { ...config, action };
    setConfig(newConfig);
    chrome.runtime.sendMessage({
      type: "SET_DOH_MONITOR_CONFIG",
      data: { action },
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
      gridTemplateColumns: "1fr 1fr 1fr",
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
    optionSelected: {
      background: colors.bgTertiary || colors.border,
    },
    radio: {
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

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          DoH監視 ({ACTION_OPTIONS.find(o => o.value === config.action)?.label})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <div style={styles.content}>
          {ACTION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                ...styles.option,
                ...(config.action === opt.value ? styles.optionSelected : {}),
              }}
              onMouseEnter={(e) => {
                if (config.action !== opt.value) {
                  (e.currentTarget as HTMLElement).style.background = colors.bgTertiary || colors.border;
                }
              }}
              onMouseLeave={(e) => {
                if (config.action !== opt.value) {
                  (e.currentTarget as HTMLElement).style.background = colors.bgSecondary;
                }
              }}
            >
              <input
                type="radio"
                name="doh-action"
                checked={config.action === opt.value}
                onChange={() => handleActionChange(opt.value)}
                style={styles.radio}
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
