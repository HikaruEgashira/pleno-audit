import type { CSSProperties } from "preact/compat";
import { useTheme, type ThemeColors } from "../lib/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  children: preact.ComponentChildren;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.15s",
};

function getVariantStyles(colors: ThemeColors): Record<ButtonVariant, CSSProperties> {
  return {
    primary: {
      background: colors.interactive,
      color: colors.textInverse,
    },
    secondary: {
      background: colors.bgPrimary,
      color: colors.textPrimary,
      border: `1px solid ${colors.border}`,
    },
    ghost: {
      background: "transparent",
      color: colors.textSecondary,
    },
  };
}

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    padding: "6px 12px",
    fontSize: "12px",
  },
  md: {
    padding: "8px 16px",
    fontSize: "13px",
  },
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  disabled = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const variantStyles = getVariantStyles(colors);

  return (
    <button
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
