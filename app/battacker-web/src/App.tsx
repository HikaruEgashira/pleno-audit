import { useState } from "react";
import { useBattacker } from "./hooks/useBattacker";
import { CyberGauge } from "./components/CyberGauge";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { HistoryTab } from "./tabs/HistoryTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ResultsTab } from "./tabs/ResultsTab";
import type { TabType } from "./types";

export default function App() {
  const { score, history, loading, running, scanProgress, scanPhase, runTests } = useBattacker();
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
      <Header />

      {score ? (
        <>
          <TabBar activeTab={activeTab} onChange={setActiveTab} />

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
