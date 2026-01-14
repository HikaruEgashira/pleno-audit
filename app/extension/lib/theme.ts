/**
 * Theme system for dark mode support
 * Based on ADR-005 design system with dark mode variants
 */

import { createContext } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";
import type { CSSProperties } from "preact/compat";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  // Background
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  // Border
  border: string;
  borderLight: string;
  // Interactive
  interactive: string;
  interactiveHover: string;
  // Scrollbar
  scrollbar: {
    track: string;
    thumb: string;
    thumbHover: string;
  };
  // Status badges
  status: {
    default: { bg: string; text: string; border: string };
    success: { bg: string; text: string; border: string };
    warning: { bg: string; text: string; border: string };
    danger: { bg: string; text: string; border: string };
    info: { bg: string; text: string; border: string };
  };
  // Dot colors
  dot: {
    default: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
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
  scrollbar: {
    track: "hsl(0 0% 95%)",
    thumb: "hsl(0 0% 75%)",
    thumbHover: "hsl(0 0% 60%)",
  },
  status: {
    default: { bg: "#fafafa", text: "#666", border: "#eaeaea" },
    success: { bg: "#d3f9d8", text: "#0a7227", border: "#b8f0c0" },
    warning: { bg: "#fff8e6", text: "#915b00", border: "#ffe58f" },
    danger: { bg: "#fee", text: "#c00", border: "#fcc" },
    info: { bg: "#e6f4ff", text: "#0050b3", border: "#91caff" },
  },
  dot: {
    default: "#666",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
};

export const darkColors: ThemeColors = {
  bgPrimary: "#1a1a1a",
  bgSecondary: "#222",
  bgTertiary: "#2a2a2a",
  textPrimary: "#e5e5e5",
  textSecondary: "#a0a0a0",
  textMuted: "#666",
  textInverse: "#000",
  border: "#333",
  borderLight: "#2a2a2a",
  interactive: "#fff",
  interactiveHover: "#ccc",
  scrollbar: {
    track: "#2a2a2a",
    thumb: "#555",
    thumbHover: "#666",
  },
  status: {
    default: { bg: "#2a2a2a", text: "#a0a0a0", border: "#333" },
    success: { bg: "#0a3d1a", text: "#4ade80", border: "#166534" },
    warning: { bg: "#3d2e0a", text: "#fbbf24", border: "#92400e" },
    danger: { bg: "#3d0a0a", text: "#f87171", border: "#991b1b" },
    info: { bg: "#0a2a3d", text: "#60a5fa", border: "#1e40af" },
  },
  dot: {
    default: "#a0a0a0",
    success: "#4ade80",
    warning: "#fbbf24",
    danger: "#f87171",
    info: "#60a5fa",
  },
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const defaultContext: ThemeContextValue = {
  mode: "system",
  isDark: false,
  colors: lightColors,
  setMode: () => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultContext);

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeState(): ThemeContextValue {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    // Load saved preference
    chrome.storage.local.get(["themeMode"]).then((result) => {
      if (result.themeMode) {
        setModeState(result.themeMode);
      }
    });

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    chrome.storage.local.set({ themeMode: newMode });
  };

  const isDark = mode === "dark" || (mode === "system" && systemDark);
  const colors = isDark ? darkColors : lightColors;

  // Update CSS variables for theme
  useEffect(() => {
    const root = document.documentElement;
    // Background and text colors
    root.style.setProperty("--bg-primary", colors.bgPrimary);
    root.style.setProperty("--bg-secondary", colors.bgSecondary);
    root.style.setProperty("--text-primary", colors.textPrimary);
    // Scrollbar colors
    root.style.setProperty("--scrollbar-track", colors.scrollbar.track);
    root.style.setProperty("--scrollbar-thumb", colors.scrollbar.thumb);
    root.style.setProperty("--scrollbar-thumb-hover", colors.scrollbar.thumbHover);
  }, [colors]);

  return { mode, isDark, colors, setMode };
}

// Helper to create theme-aware styles
export function createThemedStyles<T extends Record<string, CSSProperties>>(
  factory: (colors: ThemeColors) => T
) {
  return factory;
}

// ============================================
// Design Tokens (ADR-005)
// ============================================

/** スペーシングスケール */
export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
} as const;

/** フォントサイズスケール */
export const fontSize = {
  xs: "10px",
  sm: "11px",
  md: "12px",
  base: "13px",
  lg: "14px",
  xl: "16px",
  xxl: "20px",
  display: "32px",
} as const;

/** グリッド設定 */
export const grid = {
  statsMinWidth: "140px",
  cardMinWidth: "280px",
} as const;

/** ボーダー半径 */
export const borderRadius = {
  sm: "4px",
  md: "6px",
  lg: "8px",
} as const;

/** Severity色を取得（critical/high/medium/low対応） */
export function getSeverityColor(
  severity: string,
  colors: ThemeColors
): string {
  switch (severity) {
    case "critical":
      return colors.dot.danger;
    case "high":
      return colors.dot.warning;
    case "medium":
      return colors.dot.info;
    case "low":
      return colors.dot.success;
    default:
      return colors.dot.default;
  }
}
