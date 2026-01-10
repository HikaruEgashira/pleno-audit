import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeColors } from "../lib/theme";

interface StatCardProps {
  value: number | string;
  label: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  onClick?: () => void;
}

function getStyles(colors: ThemeColors, isDark: boolean): Record<string, CSSProperties> {
  return {
    card: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "20px",
    },
    cardClickable: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "20px",
      cursor: "pointer",
      transition: "border-color 0.15s",
    },
    value: {
      fontSize: "32px",
      fontWeight: 600,
      color: colors.textPrimary,
      lineHeight: 1,
    },
    label: {
      fontSize: "13px",
      color: colors.textSecondary,
      marginTop: "8px",
    },
    trend: {
      fontSize: "12px",
      marginTop: "8px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    trendUp: {
      color: isDark ? "#f87171" : "#c00",
    },
    trendDown: {
      color: isDark ? "#4ade80" : "#0a7227",
    },
  };
}

export function StatCard({ value, label, trend, onClick }: StatCardProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div
      style={onClick ? styles.cardClickable : styles.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLElement).style.borderColor = colors.textMuted;
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget as HTMLElement).style.borderColor = colors.border;
      }}
    >
      <div style={styles.value}>{displayValue}</div>
      <div style={styles.label}>{label}</div>
      {trend && trend.value > 0 && (
        <div style={{ ...styles.trend, ...(trend.isUp ? styles.trendUp : styles.trendDown) }}>
          {trend.isUp ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  );
}
