import { Card } from "../../../components";
import type { DashboardStyles } from "../styles";
import { truncate } from "../utils";

interface HorizontalBarChartProps {
  data: { label: string; value: number }[];
  title: string;
  styles: DashboardStyles;
}

export function HorizontalBarChart({ data, title, styles }: HorizontalBarChartProps) {
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
