import { useState, useEffect, useCallback } from "react";
import {
  type DefenseScore,
  allAttacks,
  runAllTests,
  calculateDefenseScore,
  createWebStorage,
} from "@pleno-audit/battacker";

const storage = createWebStorage();

interface UseBattackerReturn {
  score: DefenseScore | null;
  history: DefenseScore[];
  loading: boolean;
  running: boolean;
  scanProgress: number;
  scanPhase: string;
  runTests: () => Promise<void>;
}

export function useBattacker(): UseBattackerReturn {
  const [score, setScore] = useState<DefenseScore | null>(null);
  const [history, setHistory] = useState<DefenseScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [lastResult, historyData] = await Promise.all([
          storage.getLastResult(),
          storage.getHistory(),
        ]);
        setScore(lastResult);
        setHistory(historyData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runTests = useCallback(async () => {
    setRunning(true);
    setScanProgress(0);

    try {
      const resultPromise = (async () => {
        console.log("Starting tests with", allAttacks.length, "attacks");
        console.log("Attacks:", allAttacks.map(a => a.name));
        const testResults = await runAllTests(
          allAttacks,
          (completed, total, current) => {
            console.log(`Testing: ${current.name} (${completed}/${total})`);
          }
        );
        console.log("Test results:", testResults.map(r => ({
          name: r.test.name,
          blocked: r.result.blocked,
          detected: r.result.detected,
          details: r.result.details,
        })));
        const score = calculateDefenseScore(testResults);
        console.log("Final score:", score.totalScore, "Grade:", score.grade);
        return score;
      })();

      setScanPhase("INITIALIZING");
      for (let i = 0; i <= 15; i++) {
        setScanProgress(i);
        await delay(40);
      }

      setScanPhase("TRACKING VECTORS");
      for (let i = 15; i <= 35; i++) {
        setScanProgress(i);
        await delay(40);
      }

      setScanPhase("PROBING DEFENSES");
      for (let i = 35; i <= 55; i++) {
        setScanProgress(i);
        await delay(40);
      }

      setScanPhase("NETWORK SCAN");
      for (let i = 55; i <= 75; i++) {
        setScanProgress(i);
        await delay(40);
      }

      setScanPhase("ANALYZING DATA");
      for (let i = 75; i <= 95; i++) {
        setScanProgress(i);
        await delay(40);
      }

      setScanPhase("COMPLETE");
      for (let i = 95; i <= 100; i++) {
        setScanProgress(i);
        await delay(30);
      }

      await delay(400);

      const result = await resultPromise;
      await storage.saveResult(result);
      setScore(result);
      setHistory((prev) => [result, ...prev]);
    } catch (error) {
      console.error("Failed to run tests:", error);
    } finally {
      setRunning(false);
      setScanProgress(0);
      setScanPhase("");
    }
  }, []);

  return {
    score,
    history,
    loading,
    running,
    scanProgress,
    scanPhase,
    runTests,
  };
}
