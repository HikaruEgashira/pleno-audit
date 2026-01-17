import { useState } from "react";
import { motion } from "motion/react";
import type { DefenseScore, CategoryScore, TestResult } from "@pleno-audit/battacker";
import { CATEGORY_LABELS } from "@pleno-audit/battacker";
import { useBattacker } from "./hooks/useBattacker";
import { CyberGauge } from "./components/CyberGauge";

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
        <button className="btn btn-primary" onClick={runTests} disabled={running}>
          {running ? "[ Executing... ]" : "[ Execute Scan ]"}
        </button>
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
              scanProgress={scanProgress}
              scanPhase={scanPhase}
            />
          )}
          {activeTab === "results" && <ResultsTab score={score} />}
          {activeTab === "history" && <HistoryTab history={history} />}
        </>
      ) : (
        <div className="empty-state">
          <h3>System Standby</h3>
          <p>Execute security scan to evaluate browser defense capabilities</p>
        </div>
      )}
    </div>
  );
}

function OverviewTab({
  score,
  isScanning,
  scanProgress,
  scanPhase,
}: {
  score: DefenseScore;
  isScanning: boolean;
  scanProgress: number;
  scanPhase: string;
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
          phase={scanPhase}
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
            const isRevealed =
              !isScanning || scanProgress > revealThreshold * (index + 1);
            const isDecoding =
              isScanning &&
              scanProgress > revealThreshold * index &&
              !isRevealed;

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
    return <DecodingCategoryBar category={category} index={index} />;
  }

  return (
    <motion.div
      className="category-bar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="category-bar-header">
        <span className="category-bar-name">
          {CATEGORY_LABELS[category.category]}
        </span>
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
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            delay: index * 0.1,
          }}
        />
        <motion.div
          className="skeleton-line"
          style={{ width: "32px", height: "10px" }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            delay: index * 0.1 + 0.2,
          }}
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

function DecodingCategoryBar({
  category,
}: {
  category: CategoryScore;
  index: number;
}) {
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
              {Math.random() > 0.5
                ? chars[Math.floor(Math.random() * chars.length)]
                : char}
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

function ScanDataStream({
  progress,
  phase,
}: {
  progress: number;
  phase: string;
}) {
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
