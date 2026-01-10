/**
 * Vercel-style minimal UI design system
 * Unified with dashboard components
 */

import type { CSSProperties } from "preact/compat";

export const styles: Record<string, CSSProperties> = {
  container: {
    width: "400px",
    maxHeight: "600px",
    backgroundColor: "#fafafa",
    color: "#111",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
    fontSize: "13px",
    lineHeight: 1.5,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  },

  header: {
    padding: "16px",
    borderBottom: "1px solid #eaeaea",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    background: "#fff",
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
    borderBottom: "1px solid #eaeaea",
    background: "#fff",
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
    color: "#666",
  },

  tabBtnActive: {
    color: "#000",
    borderBottomColor: "#000",
    fontWeight: 500,
  },

  tabBtnInactive: {
    color: "#666",
    borderBottomColor: "transparent",
  },

  content: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
    background: "#fafafa",
  },

  section: {
    marginBottom: "16px",
  },

  sectionTitle: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#666",
    marginBottom: "12px",
    margin: "0 0 12px 0",
  },

  card: {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "12px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "12px",
  },

  tableHeader: {
    backgroundColor: "#fafafa",
    borderBottom: "1px solid #eaeaea",
    fontWeight: 500,
    fontSize: "11px",
    textAlign: "left" as const,
    padding: "10px 12px",
    color: "#666",
  },

  tableCell: {
    padding: "10px 12px",
    borderBottom: "1px solid #f5f5f5",
    color: "#333",
  },

  tableRow: {
    transition: "background 0.1s",
  },

  stat: {
    display: "flex",
    flexDirection: "column" as const,
    padding: "16px",
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    minWidth: "80px",
  },

  statValue: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#000",
    lineHeight: 1,
  },

  statLabel: {
    fontSize: "12px",
    color: "#666",
    marginTop: "6px",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    backgroundColor: "#fafafa",
    border: "1px solid #eaeaea",
    borderRadius: "9999px",
    fontSize: "11px",
    color: "#666",
    fontWeight: 500,
  },

  badgeDanger: {
    backgroundColor: "#fee",
    color: "#c00",
    border: "1px solid #fcc",
  },

  badgeWarning: {
    backgroundColor: "#fff8e6",
    color: "#915b00",
    border: "1px solid #ffe58f",
  },

  badgeSuccess: {
    backgroundColor: "#d3f9d8",
    color: "#0a7227",
    border: "1px solid #b8f0c0",
  },

  code: {
    fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
    fontSize: "11px",
    backgroundColor: "#fafafa",
    padding: "2px 6px",
    borderRadius: "4px",
    wordBreak: "break-all" as const,
  },

  emptyText: {
    color: "#999",
    padding: "24px",
    textAlign: "center" as const,
    fontSize: "13px",
  },

  button: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 16px",
    backgroundColor: "#000",
    color: "#fff",
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
    backgroundColor: "#fff",
    color: "#333",
    border: "1px solid #eaeaea",
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
    color: "#666",
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
    border: "1px solid #eaeaea",
    borderRadius: "6px",
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "border-color 0.15s",
    background: "#fff",
  },

  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "6px",
    color: "#333",
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
    borderTop: "1px solid #eaeaea",
    marginTop: "16px",
    paddingTop: "16px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginBottom: "16px",
  },
};
