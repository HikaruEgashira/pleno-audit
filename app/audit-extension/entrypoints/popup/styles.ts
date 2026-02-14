/**
 * Vercel-style minimal UI design system
 * Unified with dashboard components
 * Supports light and dark themes
 */

import type { CSSProperties } from "preact/compat";
import type { ThemeColors } from "../../lib/theme";

export function createStyles(colors: ThemeColors): Record<string, CSSProperties> {
  return {
    container: {
      width: "400px",
      maxHeight: "600px",
      backgroundColor: colors.bgSecondary,
      color: colors.textPrimary,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "13px",
      lineHeight: 1.5,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column" as const,
    },

    header: {
      padding: "16px",
      borderBottom: `1px solid ${colors.border}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      background: colors.bgPrimary,
    },

    title: {
      margin: 0,
      fontSize: "16px",
      fontWeight: 600,
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    tabNav: {
      display: "flex",
      borderBottom: `1px solid ${colors.border}`,
      background: colors.bgPrimary,
    },

    tabBtn: {
      flex: 1,
      padding: "12px 8px",
      border: "none",
      background: "transparent",
      fontSize: "13px",
      cursor: "pointer",
      transition: "all 0.15s",
      borderBottom: "2px solid transparent",
      textAlign: "center" as const,
      color: colors.textSecondary,
    },

    tabBtnActive: {
      color: colors.textPrimary,
      borderBottomColor: colors.interactive,
      fontWeight: 500,
    },

    tabBtnInactive: {
      color: colors.textSecondary,
      borderBottomColor: "transparent",
    },

    tabCount: {
      marginLeft: "6px",
      padding: "1px 6px",
      borderRadius: "9999px",
      fontSize: "10px",
      fontWeight: 500,
    },

    tabCountActive: {
      background: colors.interactive,
      color: colors.textInverse,
    },

    tabCountInactive: {
      background: colors.bgTertiary,
      color: colors.textSecondary,
    },

    content: {
      flex: 1,
      overflow: "auto",
      padding: "16px",
      background: colors.bgSecondary,
    },

    section: {},

    sectionTitle: {
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
      marginBottom: "12px",
      margin: "0 0 12px 0",
    },

    card: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "10px 12px",
    },

    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: "12px",
    },

    tableHeader: {
      backgroundColor: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      fontWeight: 500,
      fontSize: "11px",
      textAlign: "left" as const,
      padding: "10px 12px",
      color: colors.textSecondary,
    },

    tableCell: {
      padding: "10px 12px",
      borderBottom: `1px solid ${colors.borderLight}`,
      color: colors.textPrimary,
    },

    tableRow: {
      transition: "background 0.1s",
    },

    stat: {
      display: "flex",
      flexDirection: "column" as const,
      padding: "16px",
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      minWidth: "80px",
    },

    statValue: {
      fontSize: "24px",
      fontWeight: 600,
      color: colors.textPrimary,
      lineHeight: 1,
    },

    statLabel: {
      fontSize: "12px",
      color: colors.textSecondary,
      marginTop: "6px",
    },

    badge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      backgroundColor: colors.status.default.bg,
      border: `1px solid ${colors.status.default.border}`,
      borderRadius: "9999px",
      fontSize: "11px",
      color: colors.status.default.text,
      fontWeight: 500,
    },

    badgeDanger: {
      backgroundColor: colors.status.danger.bg,
      color: colors.status.danger.text,
      border: `1px solid ${colors.status.danger.border}`,
    },

    badgeWarning: {
      backgroundColor: colors.status.warning.bg,
      color: colors.status.warning.text,
      border: `1px solid ${colors.status.warning.border}`,
    },

    badgeSuccess: {
      backgroundColor: colors.status.success.bg,
      color: colors.status.success.text,
      border: `1px solid ${colors.status.success.border}`,
    },

    code: {
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      fontSize: "11px",
      backgroundColor: colors.bgSecondary,
      padding: "2px 6px",
      borderRadius: "4px",
      wordBreak: "break-all" as const,
    },

    emptyText: {
      color: colors.textMuted,
      padding: "24px",
      textAlign: "center" as const,
      fontSize: "13px",
    },

    button: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 16px",
      backgroundColor: colors.interactive,
      color: colors.textInverse,
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 500,
      transition: "all 0.15s",
    },

    buttonSecondary: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px 12px",
      backgroundColor: colors.bgPrimary,
      color: colors.textPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 500,
    },

    buttonGhost: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px 12px",
      backgroundColor: "transparent",
      color: colors.textSecondary,
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 500,
    },

    input: {
      width: "100%",
      padding: "8px 12px",
      fontSize: "13px",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      boxSizing: "border-box" as const,
      outline: "none",
      transition: "border-color 0.15s",
      background: colors.bgPrimary,
      color: colors.textPrimary,
    },

    label: {
      display: "block",
      fontSize: "12px",
      fontWeight: 500,
      marginBottom: "6px",
      color: colors.textPrimary,
    },

    checkbox: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      marginBottom: "12px",
      cursor: "pointer",
    },

    divider: {
      borderTop: `1px solid ${colors.border}`,
      marginTop: "16px",
      paddingTop: "16px",
    },

    tabContent: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "8px",
    },

    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "8px",
      marginBottom: "16px",
    },
  };
}

// Hook for theme-aware styles
import { useTheme, lightColors } from "../../lib/theme";

export function usePopupStyles() {
  const { colors } = useTheme();
  return createStyles(colors);
}

// Legacy export for backward compatibility during migration
export const styles = createStyles(lightColors);
