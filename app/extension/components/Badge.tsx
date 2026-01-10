import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeColors } from "../lib/theme";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children?: preact.ComponentChildren;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
}

function getVariantStyles(colors: ThemeColors): Record<BadgeVariant, CSSProperties> {
  return {
    default: {
      background: colors.status.default.bg,
      color: colors.status.default.text,
      border: `1px solid ${colors.status.default.border}`,
    },
    success: {
      background: colors.status.success.bg,
      color: colors.status.success.text,
      border: `1px solid ${colors.status.success.border}`,
    },
    warning: {
      background: colors.status.warning.bg,
      color: colors.status.warning.text,
      border: `1px solid ${colors.status.warning.border}`,
    },
    danger: {
      background: colors.status.danger.bg,
      color: colors.status.danger.text,
      border: `1px solid ${colors.status.danger.border}`,
    },
    info: {
      background: colors.status.info.bg,
      color: colors.status.info.text,
      border: `1px solid ${colors.status.info.border}`,
    },
  };
}

export function Badge({ children, variant = "default", size = "sm", dot = false }: BadgeProps) {
  const { colors } = useTheme();
  const variantStyles = getVariantStyles(colors);

  if (dot) {
    return (
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: colors.dot[variant],
        }}
        title={typeof children === "string" ? children : undefined}
      />
    );
  }

  const sizeStyles = size === "sm"
    ? { padding: "2px 8px", fontSize: "11px" }
    : { padding: "4px 12px", fontSize: "12px" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",
        fontWeight: 500,
        ...sizeStyles,
        ...variantStyles[variant],
      }}
    >
      {children}
    </span>
  );
}
