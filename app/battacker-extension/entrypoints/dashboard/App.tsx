import { useState } from "preact/hooks";
import { useBattackerDashboard } from "./hooks/useBattackerDashboard";
import type { TabType } from "./types";
import { InitialState } from "./components/InitialState";
import { Tabs } from "./components/Tabs";
import { OverviewTab } from "./tabs/OverviewTab";
import { ResultsTab } from "./tabs/ResultsTab";
import { HistoryTab } from "./tabs/HistoryTab";

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const { score, history, loading, running, scanState, runTests } = useBattackerDashboard();

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
      </div>

      {score ? (
        <>
          <Tabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === "overview" && (
            <OverviewTab
              score={score}
              isScanning={running}
              isLoading={loading}
              scanState={scanState}
              onScan={runTests}
            />
          )}
          {activeTab === "results" && <ResultsTab score={score} />}
          {activeTab === "history" && <HistoryTab history={history} />}
        </>
      ) : (
        <InitialState
          running={running}
          loading={loading}
          scanState={scanState}
          onScan={runTests}
        />
      )}
    </div>
  );
}
