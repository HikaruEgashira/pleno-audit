import { useState, useEffect } from "preact/hooks";
import type { DefenseScore, CategoryScore, TestResult } from "../../lib/types";
import { CATEGORY_LABELS } from "../../lib/types";

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
      console.error("Failed to load data:", error);
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
      console.error("Failed to run tests:", error);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div class="dashboard">
        <div class="loading">
          <div class="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div class="dashboard">
      <div class="header">
        <div>
          <h1 class="title">Pleno Battacker</h1>
          <p class="subtitle">Browser Defense Resistance Testing Tool</p>
        </div>
        <button class="btn btn-primary" onClick={runTests} disabled={running}>
          {running ? "Running Tests..." : "Run Security Tests"}
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
              Test Results
            </button>
            <button
              class={`tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              History
            </button>
          </div>

          {activeTab === "overview" && <OverviewTab score={score} />}
          {activeTab === "results" && <ResultsTab score={score} />}
          {activeTab === "history" && <HistoryTab history={history} />}
        </>
      ) : (
        <div class="empty-state">
          <h3>No test results yet</h3>
          <p>Run security tests to evaluate your browser's defense capabilities</p>
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
          Last tested: {new Date(score.testedAt).toLocaleString()}
        </div>
      </div>

      <div class="categories-overview">
        <h3>Category Scores</h3>
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
      <h3>All Test Results ({allResults.length} tests)</h3>
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
        <h3>No history yet</h3>
        <p>Run tests multiple times to see your score history</p>
      </div>
    );
  }

  const sortedHistory = [...history].sort((a, b) => b.testedAt - a.testedAt);

  return (
    <div class="test-results">
      <h3>Test History</h3>
      <div class="test-list">
        {sortedHistory.map((entry, index) => (
          <div class="test-item" key={index}>
            <div class={`score-badge grade-${entry.grade}`}>
              {entry.totalScore}
            </div>
            <div class="test-info">
              <div class="test-name">Grade {entry.grade}</div>
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
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference * (1 - score / 100);

  const gradeColors: Record<string, string> = {
    A: "#22c55e",
    B: "#84cc16",
    C: "#eab308",
    D: "#f97316",
    F: "#dc2626",
  };

  const color = gradeColors[grade] || gradeColors.F;

  return (
    <div class="score-gauge">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle class="score-bg" cx="90" cy="90" r="70" />
        <circle
          class="score-fill"
          cx="90"
          cy="90"
          r="70"
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

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#22c55e";
    if (pct >= 60) return "#84cc16";
    if (pct >= 40) return "#eab308";
    if (pct >= 20) return "#f97316";
    return "#dc2626";
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
