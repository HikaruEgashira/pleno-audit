import type { CSSProperties } from "preact/compat";

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
  const style: CSSProperties = {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    padding: paddingSizes[padding],
  };

  const titleStyle: CSSProperties = {
    fontSize: "13px",
    fontWeight: 500,
    color: "#666",
    marginBottom: "12px",
  };

  return (
    <div style={style}>
      {title && <div style={titleStyle}>{title}</div>}
      {children}
    </div>
  );
}
