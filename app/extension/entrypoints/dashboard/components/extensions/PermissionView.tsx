import { useMemo } from "preact/hooks";
import type { ExtensionAnalysis, PermissionSummary } from "@pleno-audit/permission-analyzer";
import { Shield } from "lucide-preact";
import { useTheme, getSeverityColor, spacing } from "../../../../lib/theme";
import { Card, SearchInput, Select, Button, StatCard, LoadingState, EmptyState, StatsGrid } from "../../../../components";
import { ExtensionCard } from "./ExtensionCard";

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
    return <LoadingState message="拡張機能の権限を分析中..." />;
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
        <div style={{ marginBottom: spacing.xl }}>
          <StatsGrid>
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
          </StatsGrid>
        </div>
      )}

      {summary && summary.topRiskyPermissions.length > 0 && (
        <Card title="危険な権限 (使用頻度)" style={{ marginBottom: spacing.xl }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
            {summary.topRiskyPermissions.map((p) => {
              const riskColor = getSeverityColor(p.risk, colors);
              return (
                <div
                  key={p.permission}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: `${riskColor}15`,
                    border: `1px solid ${riskColor}40`,
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 500 }}>{p.permission}</div>
                  <div style={{ fontSize: "11px", color: colors.textMuted }}>
                    {p.count} 拡張機能で使用 • {p.risk}
                  </div>
                </div>
              );
            })}
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
          <EmptyState
            icon={Shield}
            title="分析対象の拡張機能がありません"
          />
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
          marginTop: spacing.xl,
          padding: spacing.lg,
          background: colors.bgSecondary,
          borderRadius: "8px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: spacing.sm }}>
          権限リスクレベル
        </div>
        <div style={{ display: "flex", gap: spacing.lg, fontSize: "11px", flexWrap: "wrap" }}>
          <span><span style={{ color: colors.dot.danger }}>●</span> Critical - 全サイトアクセス、リクエストブロック等</span>
          <span><span style={{ color: colors.dot.warning }}>●</span> High - 履歴、Cookie、クリップボード読取</span>
          <span><span style={{ color: colors.dot.info }}>●</span> Medium - タブ、ブックマーク、ダウンロード</span>
          <span><span style={{ color: colors.dot.success }}>●</span> Low - ストレージ、通知、activeTab</span>
        </div>
      </div>
    </div>
  );
}
