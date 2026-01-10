import type { CSSProperties } from "preact/compat";

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

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "#000",
    color: "#fff",
  },
  secondary: {
    background: "#fff",
    color: "#333",
    border: "1px solid #eaeaea",
  },
  ghost: {
    background: "transparent",
    color: "#666",
  },
};

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
