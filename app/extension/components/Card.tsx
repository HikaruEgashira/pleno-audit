import type { CSSProperties } from "preact/compat";
import { useTheme } from "../lib/theme";

interface CardProps {
  children: preact.ComponentChildren;
  title?: string;
  padding?: "sm" | "md" | "lg";
}

const paddingSizes = {
  sm: "12px",
  md: "16px",
  lg: "24px",
};

export function Card({ children, title, padding = "md" }: CardProps) {
  const { colors } = useTheme();

  const style: CSSProperties = {
    background: colors.bgPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    padding: paddingSizes[padding],
  };

  const titleStyle: CSSProperties = {
    fontSize: "13px",
    fontWeight: 500,
    color: colors.textSecondary,
    marginBottom: "12px",
  };

  return (
    <div style={style}>
      {title && <div style={titleStyle}>{title}</div>}
      {children}
    </div>
  );
}
