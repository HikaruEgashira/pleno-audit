import type { TabType } from "../types";

export function Tabs({ activeTab, onChange }: { activeTab: TabType; onChange: (tab: TabType) => void }) {
  return (
    <div class="tabs">
      <button
        class={`tab ${activeTab === "overview" ? "active" : ""}`}
        onClick={() => onChange("overview")}
      >
        Overview
      </button>
      <button
        class={`tab ${activeTab === "results" ? "active" : ""}`}
        onClick={() => onChange("results")}
      >
        Audit Log
      </button>
      <button
        class={`tab ${activeTab === "history" ? "active" : ""}`}
        onClick={() => onChange("history")}
      >
        Archives
      </button>
    </div>
  );
}
