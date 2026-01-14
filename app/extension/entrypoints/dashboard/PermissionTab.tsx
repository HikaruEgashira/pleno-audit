import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import {
  createPermissionAnalyzer,
  type ExtensionAnalysis,
  type PermissionSummary,
  type ExtensionManifest,
  PERMISSION_METADATA,
} from "@pleno-audit/permission-analyzer";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Lock,
  Unlock,
  Eye,
  Globe,
  Search,
} from "lucide-preact";
import { useTheme } from "../../lib/theme";
import { Badge, Button, Card, SearchInput, Select, StatCard } from "../../components";

function getRiskColor(risk: string): string {
  switch (risk) {
    case "critical": return "#dc2626";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#22c55e";
    default: return "#6b7280";
  }
}

function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, "danger" | "warning" | "info" | "success" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "success",
    minimal: "default",
  };
  return <Badge variant={variants[risk] || "default"}>{risk}</Badge>;
}

interface ExtensionCardProps {
  analysis: ExtensionAnalysis;
  onViewDetails: (id: string) => void;
}

function ExtensionCard({ analysis, onViewDetails }: ExtensionCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const criticalFindings = analysis.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  );

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${analysis.riskLevel === "critical" || analysis.riskLevel === "high" ? getRiskColor(analysis.riskLevel) : colors.border}`,
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: `${getRiskColor(analysis.riskLevel)}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Shield size={20} color={getRiskColor(analysis.riskLevel)} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{analysis.name}</span>
            <RiskBadge risk={analysis.riskLevel} />
            <span style={{ fontSize: "11px", color: colors.textMuted }}>
              Score: {analysis.riskScore}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {analysis.permissions.length} permissions • {analysis.findings.length} findings
          </div>

          {/* Critical Findings */}
          {criticalFindings.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              {criticalFindings.slice(0, 2).map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: getRiskColor(f.severity),
                    marginBottom: "4px",
                  }}
                >
                  <AlertTriangle size={12} />
                  {f.title}
                </div>
              ))}
            </div>
          )}

          {/* Expandable Details */}
          {expanded && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "6px",
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <strong style={{ fontSize: "12px", color: colors.textSecondary }}>
                  Permissions:
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                  {analysis.permissions.map((p) => (
                    <span
                      key={p.type}
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: `${getRiskColor(p.risk)}20`,
                        color: getRiskColor(p.risk),
                      }}
                    >
                      {p.type}
                    </span>
                  ))}
                </div>
              </div>

              {analysis.hostPermissions.length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: colors.textSecondary }}>
                    Host Permissions:
                  </strong>
                  <div style={{ fontSize: "11px", color: colors.textMuted, marginTop: "4px" }}>
                    {analysis.hostPermissions.slice(0, 5).join(", ")}
                    {analysis.hostPermissions.length > 5 &&
                      ` +${analysis.hostPermissions.length - 5} more`}
                  </div>
                </div>
              )}

              {analysis.recommendations.length > 0 && (
                <div>
                  <strong style={{ fontSize: "12px", color: colors.textSecondary }}>
                    Recommendations:
                  </strong>
                  <ul
                    style={{
                      margin: "4px 0 0 16px",
                      padding: 0,
                      fontSize: "11px",
                      color: colors.textMuted,
                    }}
                  >
                    {analysis.recommendations.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "閉じる" : "詳細"}
        </Button>
      </div>
    </div>
  );
}

export function PermissionTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<ExtensionAnalysis[]>([]);
  const [summary, setSummary] = useState<PermissionSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const analyzer = useMemo(() => createPermissionAnalyzer(), []);

  const loadExtensions = useCallback(async () => {
    try {
      // Get all installed extensions
      const extensions = await chrome.management.getAll();

      const results: ExtensionAnalysis[] = [];

      for (const ext of extensions) {
        if (ext.type !== "extension") continue;

        // Create manifest-like object from extension info
        const manifest: ExtensionManifest = {
          id: ext.id,
          name: ext.name,
          version: ext.version,
          permissions: ext.permissions || [],
          host_permissions: ext.hostPermissions || [],
        };

        const analysis = analyzer.analyzeExtension(manifest);
        results.push(analysis);
      }

      // Sort by risk score
      results.sort((a, b) => b.riskScore - a.riskScore);

      setAnalyses(results);
      setSummary(await analyzer.getSummary());
    } catch (error) {
      console.error("Failed to load extensions:", error);
    } finally {
      setLoading(false);
    }
  }, [analyzer]);

  useEffect(() => {
    loadExtensions();
  }, [loadExtensions]);

  const filteredAnalyses = useMemo(() => {
    return analyses.filter((a) => {
      if (riskFilter && a.riskLevel !== riskFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
        );
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
      {/* Stats */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            value={summary.totalExtensions}
            label="拡張機能"
          />
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
          <StatCard
            value={summary.totalPermissions}
            label="総権限数"
          />
        </div>
      )}

      {/* Permission Distribution */}
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
                <div style={{ fontSize: "13px", fontWeight: 500 }}>
                  {p.permission}
                </div>
                <div style={{ fontSize: "11px", color: colors.textMuted }}>
                  {p.count} 拡張機能で使用 • {p.risk}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
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
          onChange={setSearchQuery}
          placeholder="拡張機能名で検索..."
        />
        <Select
          value={riskFilter}
          onChange={setRiskFilter}
          options={riskOptions}
          placeholder="リスクレベル"
        />
        <Button size="sm" variant="secondary" onClick={loadExtensions}>
          再スキャン
        </Button>
      </div>

      {/* Extension List */}
      <Card title={`拡張機能分析 (${filteredAnalyses.length})`}>
        {filteredAnalyses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px", color: colors.textMuted }}>
            分析対象の拡張機能がありません
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredAnalyses.map((analysis) => (
              <ExtensionCard
                key={analysis.id}
                analysis={analysis}
                onViewDetails={(id) => console.log("View details:", id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Legend */}
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
        <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
          <span><span style={{ color: "#dc2626" }}>●</span> Critical - 全サイトアクセス、リクエストブロック等</span>
          <span><span style={{ color: "#f97316" }}>●</span> High - 履歴、Cookie、クリップボード読取</span>
          <span><span style={{ color: "#eab308" }}>●</span> Medium - タブ、ブックマーク、ダウンロード</span>
          <span><span style={{ color: "#22c55e" }}>●</span> Low - ストレージ、通知、activeTab</span>
        </div>
      </div>
    </div>
  );
}
