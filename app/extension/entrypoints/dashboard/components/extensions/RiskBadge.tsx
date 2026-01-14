import { Badge } from "../../../../components";

export function getRiskColor(risk: string): string {
  switch (risk) {
    case "critical": return "#dc2626";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#22c55e";
    default: return "#6b7280";
  }
}

export function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, "danger" | "warning" | "info" | "success" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "success",
    minimal: "default",
  };
  return <Badge variant={variants[risk] || "default"}>{risk}</Badge>;
}
