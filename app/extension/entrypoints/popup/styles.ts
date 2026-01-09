/**
 * Grayscale minimal UI styles (CSP Auditor design)
 * Design System: Monospace-first, grayscale, minimal
 */

// Font families
const FONT_MONO = "'Menlo', 'Monaco', 'Courier New', monospace";
const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const styles = {
  // Base fonts (exported for components)
  fontMono: FONT_MONO,
  fontSans: FONT_SANS,

  container: {
    width: "400px",
    maxHeight: "600px",
    backgroundColor: "hsl(0 0% 100%)",
    color: "hsl(0 0% 10%)",
    fontFamily: FONT_SANS,
    fontSize: "13px",
    lineHeight: 1.5,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  },

  header: {
    padding: "12px 16px",
    borderBottom: "1px solid hsl(0 0% 90%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },

  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    flex: 1,
  },

  clearBtn: {
    padding: "4px 12px",
    fontSize: "12px",
    backgroundColor: "hsl(0 0% 95%)",
    border: "1px solid hsl(0 0% 80%)",
    borderRadius: "3px",
    cursor: "pointer",
    color: "hsl(0 0% 30%)",
    transition: "all 0.15s ease",
  },

  tabNav: {
    display: "flex",
    borderBottom: "1px solid hsl(0 0% 90%)",
    backgroundColor: "hsl(0 0% 98%)",
  },

  tabBtn: {
    flex: 1,
    padding: "10px 8px",
    border: "none",
    background: "transparent",
    fontSize: "11px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    borderBottom: "2px solid transparent",
    textAlign: "center" as const,
  },

  tabBtnActive: {
    color: "hsl(0 0% 10%)",
    borderBottomColor: "hsl(0 0% 20%)",
    fontWeight: 500,
  },

  tabBtnInactive: {
    color: "hsl(0 0% 50%)",
    borderBottomColor: "transparent",
  },

  content: {
    flex: 1,
    overflow: "auto",
    padding: "12px 16px",
  },

  section: {
    marginBottom: "12px",
  },

  sectionTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "hsl(0 0% 30%)",
    marginBottom: "8px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    margin: "0 0 8px 0",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "12px",
  },

  tableHeader: {
    backgroundColor: "hsl(0 0% 95%)",
    borderBottom: "1px solid hsl(0 0% 85%)",
    fontWeight: 600,
    fontSize: "11px",
    textAlign: "left" as const,
    padding: "6px 8px",
  },

  tableCell: {
    padding: "6px 8px",
    borderBottom: "1px solid hsl(0 0% 95%)",
  },

  tableRow: {},

  stat: {
    display: "inline-block",
    marginRight: "16px",
    marginBottom: "8px",
  },

  statValue: {
    display: "block",
    fontSize: "20px",
    fontWeight: 700,
    color: "hsl(0 0% 20%)",
    lineHeight: 1,
  },

  statLabel: {
    display: "block",
    fontSize: "11px",
    color: "hsl(0 0% 50%)",
    marginTop: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },

  badge: {
    display: "inline-block",
    padding: "2px 6px",
    backgroundColor: "hsl(0 0% 90%)",
    borderRadius: "2px",
    fontSize: "11px",
    color: "hsl(0 0% 30%)",
  },

  code: {
    fontFamily: FONT_MONO,
    fontSize: "11px",
    backgroundColor: "hsl(0 0% 95%)",
    padding: "2px 4px",
    borderRadius: "2px",
    wordBreak: "break-all" as const,
  },

  emptyText: {
    color: "hsl(0 0% 60%)",
    margin: "20px 0",
    fontSize: "13px",
  },

  button: {
    padding: "8px 12px",
    backgroundColor: "hsl(0 0% 10%)",
    color: "hsl(0 0% 100%)",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },

  buttonSecondary: {
    padding: "6px 12px",
    backgroundColor: "hsl(0 0% 90%)",
    color: "hsl(0 0% 30%)",
    border: "1px solid hsl(0 0% 80%)",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "12px",
  },

  input: {
    width: "100%",
    padding: "8px",
    fontSize: "12px",
    border: "1px solid hsl(0 0% 80%)",
    borderRadius: "3px",
    boxSizing: "border-box" as const,
  },

  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "4px",
    color: "hsl(0 0% 30%)",
  },

  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    marginBottom: "12px",
    cursor: "pointer",
  },
};
