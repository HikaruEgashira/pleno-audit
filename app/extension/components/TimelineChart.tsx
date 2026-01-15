/**
 * @fileoverview Timeline Chart Component
 *
 * 時系列データをビジュアル化するチャートコンポーネント
 */

import { useMemo } from "preact/hooks";
import { useTheme } from "../lib/theme";

export type TimeGranularity = "hour" | "day" | "week";

interface TimelineDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

interface TimelineChartProps {
  data: TimelineDataPoint[];
  granularity: TimeGranularity;
  height?: number;
  showLabels?: boolean;
  color?: string;
  maxBars?: number;
}

function formatLabel(timestamp: number, granularity: TimeGranularity): string {
  const date = new Date(timestamp);
  switch (granularity) {
    case "hour":
      return `${date.getHours()}:00`;
    case "day":
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case "week":
      return `${date.getMonth() + 1}/${date.getDate()}週`;
  }
}

function getTimeKey(timestamp: number, granularity: TimeGranularity): number {
  const date = new Date(timestamp);
  switch (granularity) {
    case "hour":
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours()
      ).getTime();
    case "day":
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime();
    case "week": {
      const dayOfWeek = date.getDay();
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart.getTime();
    }
  }
}

export function TimelineChart({
  data,
  granularity,
  height = 120,
  showLabels = true,
  color,
  maxBars = 24,
}: TimelineChartProps) {
  const { colors } = useTheme();
  const barColor = color || colors.primary;

  const aggregatedData = useMemo(() => {
    const grouped = new Map<number, number>();

    for (const point of data) {
      const key = getTimeKey(point.timestamp, granularity);
      grouped.set(key, (grouped.get(key) || 0) + point.value);
    }

    const sorted = Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-maxBars);

    return sorted.map(([timestamp, value]) => ({
      timestamp,
      value,
      label: formatLabel(timestamp, granularity),
    }));
  }, [data, granularity, maxBars]);

  const maxValue = Math.max(...aggregatedData.map((d) => d.value), 1);

  if (aggregatedData.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textMuted,
          fontSize: "13px",
        }}
      >
        データがありません
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "2px",
          height: `${height}px`,
          padding: "0 4px",
        }}
      >
        {aggregatedData.map((point, index) => {
          const barHeight = (point.value / maxValue) * (height - 20);
          return (
            <div
              key={index}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(barHeight, 2)}px`,
                  background: barColor,
                  borderRadius: "2px 2px 0 0",
                  opacity: point.value > 0 ? 1 : 0.3,
                  transition: "height 0.2s ease",
                }}
                title={`${point.label}: ${point.value}件`}
              />
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4px",
            padding: "0 4px",
          }}
        >
          <span style={{ fontSize: "10px", color: colors.textMuted }}>
            {aggregatedData[0]?.label}
          </span>
          <span style={{ fontSize: "10px", color: colors.textMuted }}>
            {aggregatedData[aggregatedData.length - 1]?.label}
          </span>
        </div>
      )}
    </div>
  );
}

interface StackedTimelineChartProps {
  data: Array<{
    timestamp: number;
    type: string;
  }>;
  granularity: TimeGranularity;
  typeColors: Record<string, string>;
  height?: number;
  maxBars?: number;
}

export function StackedTimelineChart({
  data,
  granularity,
  typeColors,
  height = 120,
  maxBars = 24,
}: StackedTimelineChartProps) {
  const { colors } = useTheme();

  const aggregatedData = useMemo(() => {
    const grouped = new Map<number, Map<string, number>>();

    for (const point of data) {
      const key = getTimeKey(point.timestamp, granularity);
      if (!grouped.has(key)) {
        grouped.set(key, new Map());
      }
      const typeMap = grouped.get(key)!;
      typeMap.set(point.type, (typeMap.get(point.type) || 0) + 1);
    }

    const sorted = Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-maxBars);

    return sorted.map(([timestamp, typeMap]) => ({
      timestamp,
      label: formatLabel(timestamp, granularity),
      breakdown: Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
        color: typeColors[type] || colors.textMuted,
      })),
      total: Array.from(typeMap.values()).reduce((a, b) => a + b, 0),
    }));
  }, [data, granularity, maxBars, typeColors, colors.textMuted]);

  const maxValue = Math.max(...aggregatedData.map((d) => d.total), 1);

  if (aggregatedData.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textMuted,
          fontSize: "13px",
        }}
      >
        データがありません
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "2px",
          height: `${height}px`,
          padding: "0 4px",
        }}
      >
        {aggregatedData.map((point, index) => {
          const totalHeight = (point.total / maxValue) * (height - 20);
          return (
            <div
              key={index}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
              title={`${point.label}: ${point.total}件`}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(totalHeight, 2)}px`,
                  display: "flex",
                  flexDirection: "column-reverse",
                  borderRadius: "2px 2px 0 0",
                  overflow: "hidden",
                }}
              >
                {point.breakdown.map((segment, segIndex) => {
                  const segmentHeight =
                    (segment.count / point.total) * totalHeight;
                  return (
                    <div
                      key={segIndex}
                      style={{
                        width: "100%",
                        height: `${segmentHeight}px`,
                        background: segment.color,
                        minHeight: segment.count > 0 ? "1px" : "0",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "4px",
          padding: "0 4px",
        }}
      >
        <span style={{ fontSize: "10px", color: colors.textMuted }}>
          {aggregatedData[0]?.label}
        </span>
        <span style={{ fontSize: "10px", color: colors.textMuted }}>
          {aggregatedData[aggregatedData.length - 1]?.label}
        </span>
      </div>
    </div>
  );
}

interface HeatmapProps {
  data: Array<{ timestamp: number; value?: number }>;
  days?: number;
  cellSize?: number;
}

export function ActivityHeatmap({
  data,
  days = 7,
  cellSize = 14,
}: HeatmapProps) {
  const { colors } = useTheme();

  const heatmapData = useMemo(() => {
    // 24時間 x N日のグリッド
    const grid: number[][] = Array.from({ length: 24 }, () =>
      Array(days).fill(0)
    );

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    for (const point of data) {
      const date = new Date(point.timestamp);
      if (date >= startDate) {
        const dayIndex = Math.floor(
          (point.timestamp - startDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        const hour = date.getHours();
        if (dayIndex >= 0 && dayIndex < days && hour >= 0 && hour < 24) {
          grid[hour][dayIndex] += point.value || 1;
        }
      }
    }

    return grid;
  }, [data, days]);

  const maxValue = Math.max(...heatmapData.flat(), 1);

  // 曜日ラベル
  const dayLabels = useMemo(() => {
    const labels: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      labels.push(["日", "月", "火", "水", "木", "金", "土"][d.getDay()]);
    }
    return labels;
  }, [days]);

  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {/* 時間ラベル */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          paddingTop: `${cellSize + 4}px`,
        }}
      >
        {[0, 6, 12, 18].map((hour) => (
          <div
            key={hour}
            style={{
              height: `${cellSize * 6}px`,
              fontSize: "9px",
              color: colors.textMuted,
              display: "flex",
              alignItems: "flex-start",
            }}
          >
            {hour}時
          </div>
        ))}
      </div>

      {/* ヒートマップグリッド */}
      <div>
        {/* 曜日ラベル */}
        <div style={{ display: "flex", gap: "1px", marginBottom: "2px" }}>
          {dayLabels.map((label, i) => (
            <div
              key={i}
              style={{
                width: `${cellSize}px`,
                textAlign: "center",
                fontSize: "9px",
                color: colors.textMuted,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* セル */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          {heatmapData.map((row, hour) => (
            <div key={hour} style={{ display: "flex", gap: "1px" }}>
              {row.map((value, dayIndex) => {
                const intensity = value / maxValue;
                return (
                  <div
                    key={dayIndex}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      background:
                        value > 0
                          ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`
                          : colors.bgSecondary,
                      borderRadius: "2px",
                    }}
                    title={`${dayLabels[dayIndex]} ${hour}時: ${value}件`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
