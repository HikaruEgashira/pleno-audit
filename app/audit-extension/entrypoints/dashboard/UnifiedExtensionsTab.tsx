import { useState } from "preact/hooks";
import { useTheme } from "../../lib/theme";
import { Button } from "../../components";
import { useExtensionData, PermissionView, NetworkView } from "./components/extensions";

type SubView = "permissions" | "network";

export function UnifiedExtensionsTab() {
  const { colors } = useTheme();
  const [subView, setSubView] = useState<SubView>("permissions");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const { analyses, summary, requests, extensionMap, stats, loading, refresh } = useExtensionData();

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: "12px",
        }}
      >
        <Button
          variant={subView === "permissions" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setSubView("permissions")}
        >
          権限分析
        </Button>
        <Button
          variant={subView === "network" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setSubView("network")}
        >
          通信監視
        </Button>
      </div>

      {subView === "permissions" && (
        <PermissionView
          analyses={analyses}
          summary={summary}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          onRefresh={refresh}
          loading={loading}
        />
      )}

      {subView === "network" && (
        <NetworkView
          requests={requests}
          extensionMap={extensionMap}
          stats={stats}
          loading={loading}
        />
      )}
    </div>
  );
}
