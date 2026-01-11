/**
 * Theme system based on ADR-005 design system
 */

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderLight: string;
  interactive: string;
  interactiveHover: string;
  status: {
    default: { bg: string; text: string; border: string };
    success: { bg: string; text: string; border: string };
    warning: { bg: string; text: string; border: string };
    danger: { bg: string; text: string; border: string };
    info: { bg: string; text: string; border: string };
  };
}

export const lightColors: ThemeColors = {
  bgPrimary: "#fff",
  bgSecondary: "#fafafa",
  bgTertiary: "#f5f5f5",
  textPrimary: "#111",
  textSecondary: "#666",
  textMuted: "#999",
  textInverse: "#fff",
  border: "#eaeaea",
  borderLight: "#f5f5f5",
  interactive: "#000",
  interactiveHover: "#333",
  status: {
    default: { bg: "#fafafa", text: "#666", border: "#eaeaea" },
    success: { bg: "#d3f9d8", text: "#0a7227", border: "#b8f0c0" },
    warning: { bg: "#fff8e6", text: "#915b00", border: "#ffe58f" },
    danger: { bg: "#fee", text: "#c00", border: "#fcc" },
    info: { bg: "#e6f4ff", text: "#0050b3", border: "#91caff" },
  },
};

export const darkColors: ThemeColors = {
  bgPrimary: "#0a0a0a",
  bgSecondary: "#111",
  bgTertiary: "#1a1a1a",
  textPrimary: "#e5e5e5",
  textSecondary: "#a0a0a0",
  textMuted: "#666",
  textInverse: "#000",
  border: "#333",
  borderLight: "#2a2a2a",
  interactive: "#fff",
  interactiveHover: "#ccc",
  status: {
    default: { bg: "#2a2a2a", text: "#a0a0a0", border: "#333" },
    success: { bg: "#0a3d1a", text: "#4ade80", border: "#166534" },
    warning: { bg: "#3d2e0a", text: "#fbbf24", border: "#92400e" },
    danger: { bg: "#3d0a0a", text: "#f87171", border: "#991b1b" },
    info: { bg: "#0a2a3d", text: "#60a5fa", border: "#1e40af" },
  },
};
