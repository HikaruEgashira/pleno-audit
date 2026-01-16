import { createLogger } from "@pleno-audit/extension-runtime";
import { useState, useEffect } from "preact/hooks";
import type { DefenseScore, CategoryScore, TestResult } from "../../lib/types";
import { CATEGORY_LABELS } from "../../lib/types";

const logger = createLogger("battacker-dashboard");

type TabType = "overview" | "results" | "history";

export function App() {
  const [score, setScore] = useState<DefenseScore | null>(null);
  const [history, setHistory] = useState<DefenseScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [result, historyData] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_LAST_RESULT" }),
        chrome.runtime.sendMessage({ type: "GET_HISTORY" }),
      ]);
      setScore(result);
      setHistory(historyData);
    } catch (error) {
      logger.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function runTests() {
    setRunning(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: "RUN_TESTS" });
      if (!("error" in result)) {
        setScore(result);
        setHistory((prev) => [...prev, result]);
      }
    } catch (error) {
      logger.error("Failed to run tests:", error);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div class="dashboard">
        <div class="loading">
          <div class="spinner" />
          <span>Initializing System...</span>
        </div>
      </div>
    );
  }

  return (
    <div class="dashboard">
      <div class="header">
        <div>
          <h1 class="title">Battacker</h1>
          <p class="subtitle">// Browser Defense Resistance Testing System</p>
        </div>
        <button class="btn btn-primary" onClick={runTests} disabled={running}>
          {running ? "[ Executing... ]" : "[ Execute Scan ]"}
        </button>
      </div>

      {score ? (
        <>
          <div class="tabs">
            <button
              class={`tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              class={`tab ${activeTab === "results" ? "active" : ""}`}
              onClick={() => setActiveTab("results")}
            >
              Audit Log
            </button>
            <button
              class={`tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Archives
            </button>
          </div>

          {activeTab === "overview" && <OverviewTab score={score} />}
          {activeTab === "results" && <ResultsTab score={score} />}
          {activeTab === "history" && <HistoryTab history={history} />}
        </>
      ) : (
        <div class="empty-state">
          <h3>System Standby</h3>
          <p>Execute security scan to evaluate browser defense capabilities</p>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ score }: { score: DefenseScore }) {
  return (
    <div class="overview">
      <div class="score-card">
        <ScoreGauge score={score.totalScore} grade={score.grade} />
        <div class="score-meta">
          Timestamp: {new Date(score.testedAt).toLocaleString()}
        </div>
      </div>

      <div class="categories-overview">
        <h3>Category Analysis</h3>
        <div class="category-bars">
          {score.categories.map((cat) => (
            <CategoryBar key={cat.category} category={cat} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsTab({ score }: { score: DefenseScore }) {
  const allResults = score.categories.flatMap((cat) => cat.testResults);

  return (
    <div class="test-results">
      <h3>Security Audit Results // {allResults.length} Tests Executed</h3>
      <div class="test-list">
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
      <div class="empty-state">
        <h3>No Archives Available</h3>
        <p>Execute multiple scans to build historical records</p>
      </div>
    );
  }

  const sortedHistory = [...history].sort((a, b) => b.testedAt - a.testedAt);

  return (
    <div class="test-results">
      <h3>Archived Scan Results</h3>
      <div class="test-list">
        {sortedHistory.map((entry, index) => (
          <div class="test-item" key={index}>
            <div class={`score-badge grade-${entry.grade}`}>
              {entry.totalScore}
            </div>
            <div class="test-info">
              <div class="test-name">Classification: Grade {entry.grade}</div>
              <div class="test-description">
                {new Date(entry.testedAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 80;
  const dashOffset = circumference * (1 - score / 100);

  // Monochrome grade colors - white to dark gray
  const gradeColors: Record<string, string> = {
    A: "#ffffff",
    B: "#cccccc",
    C: "#999999",
    D: "#666666",
    F: "#444444",
  };

  const color = gradeColors[grade] || gradeColors.F;

  return (
    <div class="score-gauge">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle class="score-bg" cx="100" cy="100" r="80" />
        <circle
          class="score-fill"
          cx="100"
          cy="100"
          r="80"
          stroke={color}
          stroke-dasharray={circumference}
          stroke-dashoffset={dashOffset}
        />
      </svg>
      <div class="score-text">
        <div class={`score-value grade-${grade}`}>{score}</div>
        <div class="score-grade">Grade {grade}</div>
      </div>
    </div>
  );
}

function CategoryBar({ category }: { category: CategoryScore }) {
  const percentage =
    category.maxScore > 0
      ? Math.round((category.score / category.maxScore) * 100)
      : 0;

  // Monochrome bar colors - white to dark gray based on percentage
  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#ffffff";
    if (pct >= 60) return "#cccccc";
    if (pct >= 40) return "#999999";
    if (pct >= 20) return "#666666";
    return "#444444";
  };

  return (
    <div class="category-bar">
      <div class="category-bar-header">
        <span class="category-bar-name">{CATEGORY_LABELS[category.category]}</span>
        <span class="category-bar-value">{percentage}%</span>
      </div>
      <div class="category-bar-track">
        <div
          class="category-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: getBarColor(percentage),
          }}
        />
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
    <div class="test-item">
      <div class={`test-status ${getStatusClass()}`}>{getStatusIcon()}</div>
      <div class="test-info">
        <div class="test-name">{test.name}</div>
        <div class="test-description">{test.description}</div>
      </div>
      <div class="test-details">
        <span class={`severity-badge severity-${test.severity}`}>
          {test.severity}
        </span>
        <div class="test-time">{testResult.executionTime.toFixed(0)}ms</div>
      </div>
    </div>
  );
}
