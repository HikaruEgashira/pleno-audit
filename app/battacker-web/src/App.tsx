import { useState } from "react";
import { motion } from "framer-motion";
import type { DefenseScore, CategoryScore, TestResult } from "@pleno-audit/battacker";
import { CATEGORY_LABELS } from "@pleno-audit/battacker";
import { useBattacker } from "./hooks/useBattacker";

type TabType = "overview" | "results" | "history";

export default function App() {
  const { score, history, loading, running, scanProgress, scanPhase, runTests } =
    useBattacker();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner" />
          <span>Initializing System...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="header">
        <div>
          <h1 className="title">Battacker</h1>
          <p className="subtitle">// Browser Defense Resistance Testing System</p>
        </div>
      </div>

      {score ? (
        <>
          <div className="tabs">
            <button
              className={`tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`tab ${activeTab === "results" ? "active" : ""}`}
              onClick={() => setActiveTab("results")}
            >
              Audit Log
            </button>
            <button
              className={`tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Archives
            </button>
          </div>

          {activeTab === "overview" && (
            <OverviewTab
              score={score}
              isScanning={running}
              isLoading={loading}
              scanProgress={scanProgress}
              scanPhase={scanPhase}
              onScan={runTests}
            />
          )}
          {activeTab === "results" && <ResultsTab score={score} />}
          {activeTab === "history" && <HistoryTab history={history} />}
        </>
      ) : (
        <div className="initial-state">
          <div className="score-card initial">
            <CyberGauge
              value={running ? scanProgress : 0}
              grade=""
              isScanning={running}
              isLoading={loading}
              phase={scanPhase}
              onClick={running || loading ? undefined : runTests}
            />
            <div className="score-meta">
              {running ? "Scanning in progress..." : "Ready to execute security scan"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewTab({
  score,
  isScanning,
  isLoading,
  scanProgress,
  scanPhase,
  onScan,
}: {
  score: DefenseScore;
  isScanning: boolean;
  isLoading: boolean;
  scanProgress: number;
  scanPhase: string;
  onScan: () => void;
}) {
  const categoryCount = score.categories.length;
  const revealThreshold = 100 / (categoryCount + 1);

  return (
    <div className="overview">
      <div className="score-card">
        <CyberGauge
          value={isScanning ? scanProgress : score.totalScore}
          grade={isScanning ? "" : score.grade}
          isScanning={isScanning}
          isLoading={isLoading}
          phase={scanPhase}
          onClick={isScanning || isLoading ? undefined : onScan}
        />
        {isScanning ? (
          <SkeletonMeta />
        ) : (
          <div className="score-meta">
            Timestamp: {new Date(score.testedAt).toLocaleString()}
          </div>
        )}
      </div>

      <div className="categories-overview">
        <h3 className="section-title">
          {isScanning ? (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              // Analyzing Defense Vectors...
            </motion.span>
          ) : (
            "Category Analysis"
          )}
        </h3>
        <div className="category-bars">
          {score.categories.map((cat, index) => {
            const isRevealed = !isScanning || scanProgress > revealThreshold * (index + 1);
            const isDecoding = isScanning && scanProgress > revealThreshold * index && !isRevealed;

            return (
              <CategoryBarWithSkeleton
                key={cat.category}
                category={cat}
                isRevealed={isRevealed}
                isDecoding={isDecoding}
                index={index}
              />
            );
          })}
        </div>
      </div>

      {isScanning && <ScanDataStream progress={scanProgress} phase={scanPhase} />}
    </div>
  );
}

function SkeletonMeta() {
  return (
    <div className="score-meta skeleton-meta">
      <motion.div
        className="skeleton-line"
        style={{ width: "180px", height: "12px" }}
        animate={{
          backgroundPosition: ["200% 0", "-200% 0"],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function CategoryBarWithSkeleton({
  category,
  isRevealed,
  isDecoding,
  index,
}: {
  category: CategoryScore;
  isRevealed: boolean;
  isDecoding: boolean;
  index: number;
}) {
  const percentage =
    category.maxScore > 0
      ? Math.round((category.score / category.maxScore) * 100)
      : 0;

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#ffffff";
    if (pct >= 60) return "#cccccc";
    if (pct >= 40) return "#999999";
    if (pct >= 20) return "#666666";
    return "#444444";
  };

  if (!isRevealed && !isDecoding) {
    return <SkeletonCategoryBar index={index} />;
  }

  if (isDecoding) {
    return <DecodingCategoryBar category={category} />;
  }

  return (
    <motion.div
      className="category-bar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="category-bar-header">
        <span className="category-bar-name">{CATEGORY_LABELS[category.category]}</span>
        <motion.span
          className="category-bar-value"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {percentage}%
        </motion.span>
      </div>
      <div className="category-bar-track">
        <motion.div
          className="category-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          style={{ backgroundColor: getBarColor(percentage) }}
        />
      </div>
    </motion.div>
  );
}

function SkeletonCategoryBar({ index }: { index: number }) {
  return (
    <motion.div
      className="category-bar skeleton-bar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.08 }}
    >
      <div className="category-bar-header">
        <motion.div
          className="skeleton-line"
          style={{ width: `${80 + Math.random() * 40}px`, height: "10px" }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: index * 0.1 }}
        />
        <motion.div
          className="skeleton-line"
          style={{ width: "32px", height: "10px" }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: index * 0.1 + 0.2 }}
        />
      </div>
      <div className="category-bar-track">
        <motion.div
          className="skeleton-bar-fill"
          animate={{
            width: ["20%", "60%", "35%", "80%", "45%"],
            opacity: [0.3, 0.5, 0.3, 0.6, 0.4],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

function DecodingCategoryBar({ category }: { category: CategoryScore }) {
  const chars = "01アイウエオカキクケコ░▒▓█";
  const label = CATEGORY_LABELS[category.category];

  return (
    <motion.div
      className="category-bar decoding-bar"
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
    >
      <div className="category-bar-header">
        <motion.span
          className="category-bar-name decoding-text"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          {label.split("").map((char, i) => (
            <motion.span
              key={i}
              animate={{
                opacity: [0, 1, 0.8, 1],
              }}
              transition={{
                duration: 0.4,
                delay: i * 0.03,
                repeat: 2,
              }}
            >
              {Math.random() > 0.5 ? chars[Math.floor(Math.random() * chars.length)] : char}
            </motion.span>
          ))}
        </motion.span>
        <motion.span
          className="category-bar-value"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          ---%
        </motion.span>
      </div>
      <div className="category-bar-track">
        <motion.div
          className="decoding-bar-fill"
          animate={{
            width: ["0%", "100%"],
            opacity: [0.8, 0.4, 0.8],
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <motion.div
          className="scan-line"
          animate={{ left: ["0%", "100%"] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

function ScanDataStream({ progress, phase }: { progress: number; phase: string }) {
  const dataLines = [
    `[${String(progress).padStart(3, "0")}%] SCANNING DEFENSE LAYER...`,
    `> VECTOR: ${phase}`,
    `> PACKETS: ${Math.floor(progress * 12.7)}`,
    `> LATENCY: ${(Math.random() * 50 + 10).toFixed(1)}ms`,
  ];

  return (
    <motion.div
      className="scan-data-stream"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="stream-header">
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          ▶ LIVE TELEMETRY
        </motion.span>
      </div>
      <div className="stream-content">
        {dataLines.map((line, i) => (
          <motion.div
            key={`${line}-${i}`}
            className="stream-line"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: [0.4, 1, 0.4], x: 0 }}
            transition={{
              opacity: { duration: 1.5, repeat: Infinity, delay: i * 0.2 },
              x: { duration: 0.3 },
            }}
          >
            {line}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CyberGauge({
  value,
  grade,
  isScanning,
  isLoading,
  phase,
  onClick,
}: {
  value: number;
  grade: string;
  isScanning: boolean;
  isLoading?: boolean;
  phase: string;
  onClick?: () => void;
}) {
  const isInteractive = onClick && !isScanning && !isLoading;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  const gradeColors: Record<string, string> = {
    A: "#ffffff",
    B: "#d0d0d0",
    C: "#a0a0a0",
    D: "#707070",
    F: "#505050",
    "": "#ffffff",
  };

  const color = gradeColors[grade] || gradeColors.F;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <motion.div
      className={`score-gauge ${isInteractive ? "interactive" : ""}`}
      style={{ position: "relative", cursor: isInteractive ? "pointer" : "default" }}
      onClick={handleClick}
      whileHover={isInteractive ? { scale: 1.02 } : undefined}
      whileTap={isInteractive ? { scale: 0.98 } : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glowLg" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="scanBeamLg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="10"
        />

        {/* Scanning decorations */}
        {isScanning && (
          <>
            {/* Outer rings */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 15}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="12 6"
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 25}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="6 12"
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            {/* Pulse ring */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 35}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              animate={{
                r: [radius + 35, radius + 50, radius + 35],
                opacity: [0.08, 0.2, 0.08],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Scan beam */}
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <path
                d={describeArc(cx, cy, radius, 0, 60)}
                fill="none"
                stroke="url(#scanBeamLg)"
                strokeWidth="10"
                strokeLinecap="round"
                filter="url(#glowLg)"
              />
            </motion.g>

            {/* Inner ring */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius - 20}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="3 9"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            {/* Center pulse */}
            <motion.circle
              cx={cx}
              cy={cy}
              r="4"
              fill="white"
              animate={{
                r: [4, 7, 4],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />

            {/* Data nodes */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.circle
                key={i}
                cx={cx + Math.cos((angle * Math.PI) / 180) * (radius - 12)}
                cy={cy + Math.sin((angle * Math.PI) / 180) * (radius - 12)}
                r="2"
                fill="white"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.33,
                }}
              />
            ))}
          </>
        )}

        {/* Main progress arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.15, ease: "linear" }}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${cx}px ${cy}px`,
            filter: isScanning ? "url(#glowLg)" : "none",
          }}
        />

        {/* Corner markers */}
        {!isScanning && (
          <>
            <line x1="10" y1="10" x2="30" y2="10" stroke="#333" strokeWidth="1" />
            <line x1="10" y1="10" x2="10" y2="30" stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1="10" x2={size - 30} y2="10" stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1="10" x2={size - 10} y2="30" stroke="#333" strokeWidth="1" />
            <line x1="10" y1={size - 10} x2="30" y2={size - 10} stroke="#333" strokeWidth="1" />
            <line x1="10" y1={size - 10} x2="10" y2={size - 30} stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1={size - 10} x2={size - 30} y2={size - 10} stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1={size - 10} x2={size - 10} y2={size - 30} stroke="#333" strokeWidth="1" />
          </>
        )}
      </svg>

      <div className="score-text">
        {isScanning ? (
          <motion.div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <motion.div
              className="score-value"
              style={{ color: "#fff" }}
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              {value}
            </motion.div>
            <motion.div
              key={phase}
              className="score-grade"
              style={{ fontSize: 11 }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {phase}
            </motion.div>
          </motion.div>
        ) : isLoading ? (
          <motion.div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <motion.div
              className="score-value"
              style={{ color: "#fff", fontSize: 28 }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              INIT
            </motion.div>
          </motion.div>
        ) : grade ? (
          <>
            <div className={`score-value grade-${grade}`}>{value}</div>
            <div className="score-grade">Grade {grade}</div>
            {isInteractive && (
              <motion.div
                className="scan-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                TAP TO RESCAN
              </motion.div>
            )}
          </>
        ) : (
          <>
            <motion.div
              className="score-value"
              style={{ fontSize: 32 }}
              animate={isInteractive ? { opacity: [0.8, 1, 0.8] } : undefined}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Execute
            </motion.div>
            {isInteractive && (
              <motion.div
                className="scan-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                TAP TO SCAN
              </motion.div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function ResultsTab({ score }: { score: DefenseScore }) {
  const allResults = score.categories.flatMap((cat) => cat.testResults);

  return (
    <div className="test-results">
      <h3>Security Audit Results // {allResults.length} Tests Executed</h3>
      <div className="test-list">
        {allResults.map((result) => (
          <TestResultItem key={result.test.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ history }: { history: DefenseScore[] }) {
  if (history.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Archives Available</h3>
        <p>Execute multiple scans to build historical records</p>
      </div>
    );
  }

  const sortedHistory = [...history].sort((a, b) => b.testedAt - a.testedAt);

  return (
    <div className="test-results">
      <h3>Archived Scan Results</h3>
      <div className="test-list">
        {sortedHistory.map((entry, index) => (
          <div className="test-item" key={index}>
            <div className={`score-badge grade-${entry.grade}`}>
              {entry.totalScore}
            </div>
            <div className="test-info">
              <div className="test-name">Classification: Grade {entry.grade}</div>
              <div className="test-description">
                {new Date(entry.testedAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestResultItem({ result }: { result: TestResult }) {
  const { test, result: testResult } = result;

  const getStatusIcon = () => {
    if (testResult.blocked) return "✓";
    if (testResult.detected) return "!";
    return "✗";
  };

  const getStatusClass = () => {
    if (testResult.blocked) return "blocked";
    if (testResult.detected) return "detected";
    return "success";
  };

  return (
    <div className="test-item">
      <div className={`test-status ${getStatusClass()}`}>{getStatusIcon()}</div>
      <div className="test-info">
        <div className="test-name">{test.name}</div>
        <div className="test-description">{test.description}</div>
      </div>
      <div className="test-details">
        <span className={`severity-badge severity-${test.severity}`}>
          {test.severity}
        </span>
        <div className="test-time">{testResult.executionTime.toFixed(0)}ms</div>
      </div>
    </div>
  );
}
