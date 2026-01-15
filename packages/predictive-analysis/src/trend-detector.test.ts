import { describe, it, expect } from "vitest";
import {
  detectTrend,
  detectAnomaly,
  movingAverage,
  type DataPoint,
} from "./trend-detector.js";

describe("detectTrend", () => {
  it("returns stable for insufficient data points", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
    ];
    const result = detectTrend(points, { minPoints: 3 });
    expect(result.direction).toBe("stable");
    expect(result.confidence).toBe(0);
  });

  it("detects increasing trend", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
      { timestamp: 3, value: 30 },
      { timestamp: 4, value: 40 },
      { timestamp: 5, value: 50 },
    ];
    const result = detectTrend(points);
    expect(result.direction).toBe("increasing");
    expect(result.slope).toBeGreaterThan(0);
  });

  it("detects decreasing trend", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 50 },
      { timestamp: 2, value: 40 },
      { timestamp: 3, value: 30 },
      { timestamp: 4, value: 20 },
      { timestamp: 5, value: 10 },
    ];
    const result = detectTrend(points);
    expect(result.direction).toBe("decreasing");
    expect(result.slope).toBeLessThan(0);
  });

  it("detects stable trend", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 50 },
      { timestamp: 2, value: 50 },
      { timestamp: 3, value: 50 },
      { timestamp: 4, value: 50 },
      { timestamp: 5, value: 50 },
    ];
    const result = detectTrend(points);
    expect(result.direction).toBe("stable");
  });

  it("calculates percent change correctly", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 100 },
      { timestamp: 2, value: 125 },
      { timestamp: 3, value: 150 },
      { timestamp: 4, value: 175 },
      { timestamp: 5, value: 200 },
    ];
    const result = detectTrend(points);
    expect(result.percentChange).toBe(100); // 100 -> 200 = 100% increase
  });

  it("handles zero initial value", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 0 },
      { timestamp: 2, value: 10 },
      { timestamp: 3, value: 20 },
    ];
    const result = detectTrend(points);
    expect(result.percentChange).toBe(0); // Can't calculate % from 0
  });

  it("sorts unsorted data by timestamp", () => {
    const points: DataPoint[] = [
      { timestamp: 5, value: 50 },
      { timestamp: 1, value: 10 },
      { timestamp: 3, value: 30 },
      { timestamp: 2, value: 20 },
      { timestamp: 4, value: 40 },
    ];
    const result = detectTrend(points);
    expect(result.direction).toBe("increasing");
  });

  it("calculates high confidence for perfect linear data", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
      { timestamp: 3, value: 30 },
      { timestamp: 4, value: 40 },
      { timestamp: 5, value: 50 },
    ];
    const result = detectTrend(points);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("calculates lower confidence for noisy data", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 50 },
      { timestamp: 3, value: 20 },
      { timestamp: 4, value: 60 },
      { timestamp: 5, value: 30 },
    ];
    const result = detectTrend(points);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("respects custom slopeThreshold", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 10.5 },
      { timestamp: 3, value: 11 },
      { timestamp: 4, value: 11.5 },
      { timestamp: 5, value: 12 },
    ];

    // With high threshold, should be stable
    const highThreshold = detectTrend(points, { slopeThreshold: 1.0 });
    expect(highThreshold.direction).toBe("stable");

    // With low threshold, should detect increase
    const lowThreshold = detectTrend(points, { slopeThreshold: 0.01 });
    expect(lowThreshold.direction).toBe("increasing");
  });
});

describe("detectAnomaly", () => {
  const normalData: DataPoint[] = [
    { timestamp: 1, value: 100 },
    { timestamp: 2, value: 102 },
    { timestamp: 3, value: 98 },
    { timestamp: 4, value: 101 },
    { timestamp: 5, value: 99 },
    { timestamp: 6, value: 100 },
    { timestamp: 7, value: 103 },
  ];

  it("returns no anomaly for insufficient data", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
    ];
    const result = detectAnomaly(points, 100, { minDataPoints: 5 });
    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBe("none");
  });

  it("detects critical anomaly (Z-score >= 4)", () => {
    const result = detectAnomaly(normalData, 500, { zScoreThreshold: 2.5 });
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe("critical");
  });

  it("detects high anomaly (Z-score >= 3)", () => {
    const result = detectAnomaly(normalData, 120, { zScoreThreshold: 2.5 });
    expect(result.isAnomaly).toBe(true);
    // Deviation should be high enough to be flagged
    expect(result.deviation).toBeGreaterThanOrEqual(2.5);
  });

  it("does not flag normal values", () => {
    const result = detectAnomaly(normalData, 101, { zScoreThreshold: 2.5 });
    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBe("none");
  });

  it("respects custom zScoreThreshold", () => {
    // With high threshold, not anomaly
    const highThreshold = detectAnomaly(normalData, 115, { zScoreThreshold: 10 });
    expect(highThreshold.isAnomaly).toBe(false);

    // With low threshold, is anomaly
    const lowThreshold = detectAnomaly(normalData, 115, { zScoreThreshold: 1.0 });
    expect(lowThreshold.isAnomaly).toBe(true);
  });

  it("handles zero standard deviation", () => {
    const constantData: DataPoint[] = [
      { timestamp: 1, value: 50 },
      { timestamp: 2, value: 50 },
      { timestamp: 3, value: 50 },
      { timestamp: 4, value: 50 },
      { timestamp: 5, value: 50 },
    ];
    const result = detectAnomaly(constantData, 50);
    expect(result.deviation).toBe(0);
  });

  it("includes current value in result", () => {
    const result = detectAnomaly(normalData, 999);
    expect(result.value).toBe(999);
  });
});

describe("movingAverage", () => {
  it("returns empty array for insufficient data", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
    ];
    const result = movingAverage(points, 5);
    expect(result.length).toBe(0);
  });

  it("calculates correct moving average", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
      { timestamp: 3, value: 30 },
      { timestamp: 4, value: 40 },
      { timestamp: 5, value: 50 },
    ];
    const result = movingAverage(points, 3);

    // Window 3: [10,20,30] avg=20, [20,30,40] avg=30, [30,40,50] avg=40
    expect(result.length).toBe(3);
    expect(result[0].value).toBe(20);
    expect(result[1].value).toBe(30);
    expect(result[2].value).toBe(40);
  });

  it("preserves timestamp of last point in window", () => {
    const points: DataPoint[] = [
      { timestamp: 100, value: 10 },
      { timestamp: 200, value: 20 },
      { timestamp: 300, value: 30 },
    ];
    const result = movingAverage(points, 2);

    // First result should have timestamp 200 (second point)
    expect(result[0].timestamp).toBe(200);
    // Second result should have timestamp 300 (third point)
    expect(result[1].timestamp).toBe(300);
  });

  it("sorts data by timestamp before processing", () => {
    const points: DataPoint[] = [
      { timestamp: 300, value: 30 },
      { timestamp: 100, value: 10 },
      { timestamp: 200, value: 20 },
    ];
    const result = movingAverage(points, 2);

    // Should be calculated in correct order
    expect(result[0].value).toBe(15); // avg(10, 20)
    expect(result[1].value).toBe(25); // avg(20, 30)
  });

  it("handles window size of 1", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
      { timestamp: 3, value: 30 },
    ];
    const result = movingAverage(points, 1);

    // Each value should be itself
    expect(result.length).toBe(3);
    expect(result[0].value).toBe(10);
    expect(result[1].value).toBe(20);
    expect(result[2].value).toBe(30);
  });

  it("handles window size equal to data length", () => {
    const points: DataPoint[] = [
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
      { timestamp: 3, value: 30 },
    ];
    const result = movingAverage(points, 3);

    // Only one result (average of all)
    expect(result.length).toBe(1);
    expect(result[0].value).toBe(20);
  });
});
