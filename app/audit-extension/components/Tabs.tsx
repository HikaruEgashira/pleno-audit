import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeColors } from "../lib/theme";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

function getStyles(colors: ThemeColors): Record<string, CSSProperties> {
  return {
    container: {
      display: "flex",
      borderBottom: `1px solid ${colors.border}`,
      marginBottom: "24px",
    },
    tab: {
      padding: "12px 16px",
      border: "none",
      borderBottom: "2px solid transparent",
      background: "transparent",
      fontSize: "14px",
      color: colors.textSecondary,
      cursor: "pointer",
      transition: "all 0.15s",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    tabActive: {
      padding: "12px 16px",
      border: "none",
      borderBottom: `2px solid ${colors.interactive}`,
      background: "transparent",
      fontSize: "14px",
      color: colors.textPrimary,
      fontWeight: 500,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    count: {
      background: colors.bgTertiary,
      color: colors.textSecondary,
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: 500,
    },
    countActive: {
      background: colors.interactive,
      color: colors.textInverse,
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: 500,
    },
  };
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <div style={styles.container}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            style={isActive ? styles.tabActive : styles.tab}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={isActive ? styles.countActive : styles.count}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
