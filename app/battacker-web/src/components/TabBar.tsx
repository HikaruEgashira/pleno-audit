import type { TabType } from "../types";

const tabs: Array<{ id: TabType; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "results", label: "Audit Log" },
  { id: "history", label: "Archives" },
];

export function TabBar({ activeTab, onChange }: { activeTab: TabType; onChange: (tab: TabType) => void }) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
