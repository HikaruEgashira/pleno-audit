import { useMemo } from "preact/hooks";
import type { ExtensionAnalysis, PermissionSummary } from "@pleno-audit/permission-analyzer";
import { useTheme } from "../../../../lib/theme";
import { Card, SearchInput, Select, Button, StatCard } from "../../../../components";
import { ExtensionCard } from "./ExtensionCard";
import { getRiskColor } from "./RiskBadge";

interface PermissionViewProps {
  analyses: ExtensionAnalysis[];
  summary: PermissionSummary | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  riskFilter: string;
  onRiskFilterChange: (risk: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function PermissionView({
  analyses,
  summary,
  searchQuery,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  onRefresh,
  loading,
}: PermissionViewProps) {
  const { colors } = useTheme();

  const filteredAnalyses = useMemo(() => {
    return analyses.filter((a) => {
      if (riskFilter && a.riskLevel !== riskFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [analyses, searchQuery, riskFilter]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "48px", color: colors.textSecondary }}>
        拡張機能の権限を分析中...
      </div>
    );
  }

  const riskOptions = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
    { value: "minimal", label: "Minimal" },
  ];

  return (
    <div>
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <StatCard value={summary.totalExtensions} label="拡張機能" />
          <StatCard
            value={summary.highRiskExtensions}
            label="高リスク"
            trend={summary.highRiskExtensions > 0 ? { value: summary.highRiskExtensions, isUp: true } : undefined}
          />
          <StatCard
            value={summary.criticalFindings}
            label="重大な問題"
            trend={summary.criticalFindings > 0 ? { value: summary.criticalFindings, isUp: true } : undefined}
          />
          <StatCard value={summary.totalPermissions} label="総権限数" />
        </div>
      )}

      {summary && summary.topRiskyPermissions.length > 0 && (
        <Card title="危険な権限 (使用頻度)" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {summary.topRiskyPermissions.map((p) => (
              <div
                key={p.permission}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: `${getRiskColor(p.risk)}15`,
                  border: `1px solid ${getRiskColor(p.risk)}40`,
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 500 }}>{p.permission}</div>
                <div style={{ fontSize: "11px", color: colors.textMuted }}>
                  {p.count} 拡張機能で使用 • {p.risk}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="拡張機能名で検索..."
        />
        <Select
          value={riskFilter}
          onChange={onRiskFilterChange}
          options={riskOptions}
          placeholder="リスクレベル"
        />
        <Button size="sm" variant="secondary" onClick={onRefresh}>
          再スキャン
        </Button>
      </div>

      <Card title={`拡張機能分析 (${filteredAnalyses.length})`}>
        {filteredAnalyses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px", color: colors.textMuted }}>
            分析対象の拡張機能がありません
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredAnalyses.map((analysis) => (
              <ExtensionCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        )}
      </Card>

      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          background: colors.bgSecondary,
          borderRadius: "8px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
          権限リスクレベル
        </div>
        <div style={{ display: "flex", gap: "16px", fontSize: "11px", flexWrap: "wrap" }}>
          <span><span style={{ color: "#dc2626" }}>●</span> Critical - 全サイトアクセス、リクエストブロック等</span>
          <span><span style={{ color: "#f97316" }}>●</span> High - 履歴、Cookie、クリップボード読取</span>
          <span><span style={{ color: "#eab308" }}>●</span> Medium - タブ、ブックマーク、ダウンロード</span>
          <span><span style={{ color: "#22c55e" }}>●</span> Low - ストレージ、通知、activeTab</span>
        </div>
      </div>
    </div>
  );
}
