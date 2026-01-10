import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeMode } from "../lib/theme";

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  button: {
    padding: "4px 8px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.15s",
  },
};

const modeIcons: Record<ThemeMode, string> = {
  light: "☀️",
  dark: "🌙",
  system: "💻",
};

const modeLabels: Record<ThemeMode, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme();

  const modes: ThemeMode[] = ["light", "dark", "system"];
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];

  return (
    <button
      style={{
        ...styles.button,
        color: colors.textSecondary,
      }}
      onClick={() => setMode(nextMode)}
      title={`テーマ: ${modeLabels[mode]} → ${modeLabels[nextMode]}`}
    >
      {modeIcons[mode]}
    </button>
  );
}
