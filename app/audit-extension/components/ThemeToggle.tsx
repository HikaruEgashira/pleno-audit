import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeMode } from "../lib/theme";

const styles: Record<string, CSSProperties> = {
  button: {
    width: "100%",
    padding: "8px 12px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background-color 0.15s",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left" as const,
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
      className="hover-bg"
      style={{
        ...styles.button,
        color: colors.textSecondary,
      }}
      onClick={() => setMode(nextMode)}
      title={`テーマ: ${modeLabels[mode]} → ${modeLabels[nextMode]}`}
    >
      <span style={{ width: "16px", textAlign: "center" }}>{modeIcons[mode]}</span>
      {modeLabels[mode]}
    </button>
  );
}
