import type { ThemeColors } from "../../lib/theme";
import { Card } from "../../components";
import { createDashboardStyles, truncate } from "./dashboard-utils";

interface ChartDatum {
  label: string;
  value: number;
}

export function HorizontalBarChart({
  data,
  title,
  colors,
  isDark,
}: {
  data: ChartDatum[];
  title: string;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const styles = createDashboardStyles(colors, isDark);
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const displayData = data.slice(0, 8);

  return (
    <Card title={title}>
      {displayData.length === 0 ? (
        <p style={styles.emptyText}>データなし</p>
      ) : (
        <div style={styles.chartContainer}>
          {displayData.map((item, i) => (
            <div key={i} style={styles.chartBar}>
              <span style={styles.chartLabel} title={item.label}>
                {truncate(item.label, 15)}
              </span>
              <div
                style={{
                  ...styles.chartBarInner,
                  width: `${(item.value / maxValue) * 100}%`,
                  maxWidth: "calc(100% - 160px)",
                }}
              />
              <span style={styles.chartValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
