import type { ComponentChildren } from "preact";
import { spacing } from "../lib/theme";

type GridSize = "sm" | "md" | "lg";

interface StatsGridProps {
  children: ComponentChildren;
  minWidth?: GridSize;
}

const minWidthMap: Record<GridSize, string> = {
  sm: "120px",
  md: "140px",
  lg: "160px",
};

export function StatsGrid({ children, minWidth = "md" }: StatsGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidthMap[minWidth]}, 1fr))`,
        gap: spacing.md,
      }}
    >
      {children}
    </div>
  );
}
