import { useState, useEffect } from "preact/hooks";
import type { DetectionConfig } from "@pleno-audit/extension-runtime";
import { useTheme } from "../../../lib/theme";

interface DetectionOption {
  key: keyof DetectionConfig;
  label: string;
  description: string;
}

const DETECTION_OPTIONS: DetectionOption[] = [
  { key: "enableNRD", label: "NRD", description: "新規登録ドメイン検出" },
  { key: "enableTyposquat", label: "Typosquat", description: "偽装ドメイン検出" },
  { key: "enableAI", label: "AI", description: "AIプロンプト監視" },
  { key: "enablePrivacy", label: "Privacy", description: "プライバシーポリシー検出" },
  { key: "enableTos", label: "ToS", description: "利用規約検出" },
  { key: "enableLogin", label: "Login", description: "ログインページ検出" },
];

export function DetectionSettings() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<DetectionConfig | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_DETECTION_CONFIG" })
      .then(setConfig)
      .catch(console.error);
  }, []);

  function handleToggle(key: keyof DetectionConfig) {
    if (!config) return;
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    chrome.runtime.sendMessage({
      type: "SET_DETECTION_CONFIG",
      data: newConfig,
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

  const enabledCount = Object.values(config).filter(Boolean).length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>
          検出設定 ({enabledCount}/{DETECTION_OPTIONS.length})
        </span>
        <span style={styles.chevron}>▶</span>
      </div>

      {expanded && (
        <div style={styles.content}>
          {DETECTION_OPTIONS.map((opt) => (
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
