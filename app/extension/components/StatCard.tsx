import type { CSSProperties } from "preact/compat";

interface StatCardProps {
  value: number | string;
  label: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  onClick?: () => void;
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    padding: "20px",
  },
  cardClickable: {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    padding: "20px",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  value: {
    fontSize: "32px",
    fontWeight: 600,
    color: "#000",
    lineHeight: 1,
  },
  label: {
    fontSize: "13px",
    color: "#666",
    marginTop: "8px",
  },
  trend: {
    fontSize: "12px",
    marginTop: "8px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  trendUp: {
    color: "#c00",
  },
  trendDown: {
    color: "#0a7227",
  },
};

export function StatCard({ value, label, trend, onClick }: StatCardProps) {
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div
      style={onClick ? styles.cardClickable : styles.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLElement).style.borderColor = "#999";
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget as HTMLElement).style.borderColor = "#eaeaea";
      }}
    >
      <div style={styles.value}>{displayValue}</div>
      <div style={styles.label}>{label}</div>
      {trend && trend.value > 0 && (
        <div style={{ ...styles.trend, ...(trend.isUp ? styles.trendUp : styles.trendDown) }}>
          {trend.isUp ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  );
}
