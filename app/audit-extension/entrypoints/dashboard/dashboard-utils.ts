import type { ThemeColors } from "../../lib/theme";
import type { Period } from "./dashboard-types";

export function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

export function getPeriodMs(period: Period): number {
  switch (period) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

export function getStatusBadge(
  nrdCount: number,
  violationCount: number,
  aiCount: number
) {
  if (nrdCount > 0) {
    return { variant: "danger" as const, label: "要対応", dot: false };
  }
  if (violationCount > 50) {
    return { variant: "warning" as const, label: "注意", dot: false };
  }
  if (aiCount > 0) {
    return { variant: "info" as const, label: "監視中", dot: false };
  }
  return { variant: "success" as const, label: "正常", dot: true };
}

export function createDashboardStyles(colors: ThemeColors, isDark: boolean) {
  return {
    wrapper: {
      display: "flex",
      minHeight: "100vh",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
    container: {
      flex: 1,
      maxWidth: "1200px",
      padding: "24px",
      overflowY: "auto",
    },
    header: {
      marginBottom: "32px",
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
    },
    title: {
      fontSize: "20px",
      fontWeight: 600,
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: "13px",
      marginTop: "4px",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "12px",
      marginBottom: "24px",
    },
    filterBar: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "16px",
      flexWrap: "wrap" as const,
    },
    section: {
      marginBottom: "32px",
    },
    twoColumn: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
      marginBottom: "24px",
    },
    chartContainer: {
      height: "200px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    chartBar: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    chartLabel: {
      fontSize: "12px",
      color: colors.textSecondary,
      width: "100px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    chartBarInner: {
      height: "20px",
      background: colors.interactive,
      borderRadius: "4px",
      minWidth: "4px",
    },
    chartValue: {
      fontSize: "12px",
      color: colors.textSecondary,
      minWidth: "40px",
    },
    eventItem: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "10px 12px",
      background: colors.bgSecondary,
      borderRadius: "6px",
    },
    eventTime: {
      fontSize: "12px",
      color: colors.textSecondary,
      minWidth: "70px",
    },
    code: {
      fontSize: "12px",
      fontFamily: "monospace",
      flex: 1,
      color: colors.textPrimary,
    },
    link: {
      color: isDark ? "#60a5fa" : "#0070f3",
      fontSize: "12px",
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center" as const,
      padding: "24px",
    },
  };
}
