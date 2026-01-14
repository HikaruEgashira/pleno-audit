import { useTheme, getSeverityColor, spacing } from "../lib/theme";

export type Severity = "critical" | "high" | "medium" | "low";

interface SeverityBadgeProps {
  severity: Severity;
  showLabel?: boolean;
}

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function SeverityBadge({ severity, showLabel = true }: SeverityBadgeProps) {
  const { colors } = useTheme();
  const color = getSeverityColor(severity, colors);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.xs,
        padding: `2px ${spacing.sm}`,
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 500,
        background: `${color}20`,
        color: color,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
        }}
      />
      {showLabel && severityLabels[severity]}
    </span>
  );
}
