import type { CSSProperties } from "preact/compat";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: preact.ComponentChildren;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  default: {
    background: "#fafafa",
    color: "#666",
    border: "1px solid #eaeaea",
  },
  success: {
    background: "#d3f9d8",
    color: "#0a7227",
    border: "1px solid #b8f0c0",
  },
  warning: {
    background: "#fff8e6",
    color: "#915b00",
    border: "1px solid #ffe58f",
  },
  danger: {
    background: "#fee",
    color: "#c00",
    border: "1px solid #fcc",
  },
  info: {
    background: "#e6f4ff",
    color: "#0050b3",
    border: "1px solid #91caff",
  },
};

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
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
