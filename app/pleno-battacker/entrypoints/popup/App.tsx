import { createLogger } from "@pleno-audit/extension-runtime";
import { useState, useEffect } from "preact/hooks";
import type { DefenseScore } from "../../lib/types";
import { CATEGORY_LABELS } from "../../lib/types";

const logger = createLogger("battacker-popup");

export function App() {
  const [score, setScore] = useState<DefenseScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadLastResult();
  }, []);

  async function loadLastResult() {
    try {
      const result = await chrome.runtime.sendMessage({ type: "GET_LAST_RESULT" });
      setScore(result);
    } catch (error) {
      logger.error("Failed to load result:", error);
    } finally {
      setLoading(false);
    }
  }

  async function runTests() {
    setRunning(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: "RUN_TESTS" });
      if ("error" in result) {
        logger.error("Test error:", result.error);
      } else {
        setScore(result);
      }
    } catch (error) {
      logger.error("Failed to run tests:", error);
    } finally {
      setRunning(false);
    }
  }

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL("/dashboard.html") });
  }

  if (loading) {
    return (
      <div class="container">
        <div class="loading">
          <div class="spinner" />
          <span>Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <div class="header">
        <h1 class="title">Battacker</h1>
      </div>

      {score ? (
        <>
          <ScoreGauge score={score.totalScore} grade={score.grade} />
          <CategoryList categories={score.categories} />
        </>
      ) : (
        <div class="empty-state">
          <h3>System Ready</h3>
          <p>Execute security scan to evaluate browser defense capabilities</p>
        </div>
      )}

      <div class="actions">
        <button class="btn btn-primary" onClick={runTests} disabled={running}>
          {running ? "Scanning..." : "Execute"}
        </button>
        <button class="btn btn-secondary" onClick={openDashboard}>
          [ View Analysis ]
        </button>
      </div>
    </div>
  );
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 60;
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
    <div class="score-section">
      <div class="score-gauge">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle class="score-bg" cx="80" cy="80" r="60" />
          <circle
            class="score-fill"
            cx="80"
            cy="80"
            r="60"
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
    </div>
  );
}

function CategoryList({ categories }: { categories: DefenseScore["categories"] }) {
  return (
    <div class="categories">
      {categories.map((cat) => {
        const percentage =
          cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
        return (
          <div class="category-item" key={cat.category}>
            <span class="category-name">{CATEGORY_LABELS[cat.category]}</span>
            <span class="category-score">{percentage}%</span>
          </div>
        );
      })}
    </div>
  );
}
