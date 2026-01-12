import { useState, useEffect } from "preact/hooks";
import type { CSPConfig } from "@pleno-audit/detectors";
import { useTheme } from "../../../lib/theme";

interface CSPOption {
  key: keyof Pick<CSPConfig, "enabled" | "collectCSPViolations" | "collectNetworkRequests">;
  label: string;
  description: string;
}

const CSP_OPTIONS: CSPOption[] = [
  { key: "enabled", label: "CSP監査", description: "CSP監査を有効化" },
  { key: "collectCSPViolations", label: "違反収集", description: "CSP違反を収集" },
  { key: "collectNetworkRequests", label: "リクエスト", description: "ネットワークリクエストを収集" },
];

export function CSPSettings() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<CSPConfig | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_CSP_CONFIG" })
      .then((cfg) => {
        setConfig(cfg);
        setEndpoint(cfg?.reportEndpoint ?? "");
      })
      .catch(console.error);
  }, []);

  function handleToggle(key: CSPOption["key"]) {
    if (!config) return;
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    chrome.runtime.sendMessage({
      type: "SET_CSP_CONFIG",
      data: newConfig,
    }).catch(console.error);
  }

  function handleEndpointChange(value: string) {
    setEndpoint(value);
    if (!config) return;
    chrome.runtime.sendMessage({
      type: "SET_CSP_CONFIG",
      data: { ...config, reportEndpoint: value || null },
    }).catch(console.error);
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
    endpointSection: {
      marginTop: "8px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "4px",
    },
    endpointLabel: {
      fontSize: "10px",
      color: colors.textSecondary,
    },
    endpointInput: {
      width: "100%",
      padding: "6px 8px",
      fontSize: "11px",
      border: `1px solid ${colors.border}`,
      borderRadius: "4px",
      background: colors.bgSecondary,
      color: colors.textPrimary,
      outline: "none",
    },
  };

  if (!config) return null;

  const enabledCount = CSP_OPTIONS.filter(opt => config[opt.key]).length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          CSP設定 ({enabledCount}/{CSP_OPTIONS.length})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <>
          <div style={styles.content}>
            {CSP_OPTIONS.map((opt) => (
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
          <div style={styles.endpointSection}>
            <label style={styles.endpointLabel}>レポートURL (オプション)</label>
            <input
              type="url"
              style={styles.endpointInput}
              value={endpoint}
              onChange={(e) => handleEndpointChange((e.target as HTMLInputElement).value)}
              placeholder="https://example.com/csp-report"
            />
          </div>
        </>
      )}
    </div>
  );
}
