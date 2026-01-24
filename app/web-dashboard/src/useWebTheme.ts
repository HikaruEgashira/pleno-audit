import { useState, useEffect } from "preact/hooks";
import { lightColors, darkColors, type ThemeMode, type ThemeColors } from "./lib/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

export function useWebThemeState(): ThemeContextValue {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem("themeMode") as ThemeMode | null;
    if (saved) {
      setModeState(saved);
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem("themeMode", newMode);
  };

  const isDark = mode === "dark" || (mode === "system" && systemDark);
  const colors = isDark ? darkColors : lightColors;

  // Update CSS variables for theme
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bg-primary", colors.bgPrimary);
    root.style.setProperty("--bg-secondary", colors.bgSecondary);
    root.style.setProperty("--text-primary", colors.textPrimary);
    root.style.setProperty("--scrollbar-track", colors.scrollbar.track);
    root.style.setProperty("--scrollbar-thumb", colors.scrollbar.thumb);
    root.style.setProperty("--scrollbar-thumb-hover", colors.scrollbar.thumbHover);
  }, [colors]);

  return { mode, isDark, colors, setMode };
}
