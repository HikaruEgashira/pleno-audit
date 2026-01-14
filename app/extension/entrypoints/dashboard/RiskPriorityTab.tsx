import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import {
  createRiskPrioritizer,
  type PrioritizedRisk,
  type RiskSummary,
  type RiskInput,
} from "@pleno-audit/risk-prioritization";
import type { DetectedService } from "@pleno-audit/detectors";
import {
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  Clock,
  Shield,
  Zap,
} from "lucide-preact";
import { useTheme } from "../../lib/theme";
import { Badge, Button, Card, SearchInput, Select, StatCard } from "../../components";

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#dc2626";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#22c55e";
    default: return "#6b7280";
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, "danger" | "warning" | "info" | "success" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "success",
    info: "default",
  };
  return <Badge variant={variants[severity] || "default"}>{severity.toUpperCase()}</Badge>;
}

function ScoreGauge({ score }: { score: number }) {
  const { colors } = useTheme();
  const color = score >= 80 ? "#dc2626" : score >= 60 ? "#f97316" : score >= 40 ? "#eab308" : "#22c55e";

  return (
    <div style={{ position: "relative", width: "48px", height: "48px" }}>
      <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke={colors.bgSecondary}
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${score} 100`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "12px",
          fontWeight: 700,
          color,
        }}
      >
        {score}
      </div>
    </div>
  );
}

interface RiskCardProps {
  risk: PrioritizedRisk;
  onAcknowledge: (id: string) => void;
}

function RiskCard({ risk, onAcknowledge }: RiskCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${risk.status === "open" ? getSeverityColor(risk.severity) : colors.border}`,
        padding: "16px",
        opacity: risk.status === "resolved" ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <ScoreGauge score={risk.score} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{risk.title}</span>
            <SeverityBadge severity={risk.severity} />
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {risk.domain} • {risk.category.replace(/_/g, " ")}
          </div>
          <div style={{ fontSize: "13px", marginBottom: "8px" }}>
            {risk.description}
          </div>

          {/* Impact Summary */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "8px", fontSize: "11px" }}>
            <span style={{ color: colors.textSecondary }}>
              <strong>影響:</strong> {risk.impact.businessImpact}
            </span>
            <span style={{ color: colors.textSecondary }}>
              <strong>悪用難易度:</strong> {risk.impact.exploitability}
            </span>
            {risk.impact.dataAtRisk.length > 0 && (
              <span style={{ color: "#dc2626" }}>
                <strong>リスクデータ:</strong> {risk.impact.dataAtRisk.join(", ")}
              </span>
            )}
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "6px",
              }}
            >
              {/* Risk Factors */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                  リスク要因
                </div>
                {risk.factors.filter((f) => f.present).map((factor) => (
                  <div
                    key={factor.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                      fontSize: "11px",
                    }}
                  >
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: getSeverityColor(
                          factor.weight >= 30 ? "critical" : factor.weight >= 20 ? "high" : "medium"
                        ),
                      }}
                    />
                    <span style={{ flex: 1 }}>{factor.name}</span>
                    <span style={{ color: colors.textMuted }}>+{factor.weight}pt</span>
                  </div>
                ))}
              </div>

              {/* Remediation Actions */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
                  推奨アクション
                </div>
                {risk.remediation.map((action) => (
                  <div
                    key={action.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                      fontSize: "11px",
                    }}
                  >
                    {action.status === "completed" ? (
                      <CheckCircle size={12} color="#22c55e" />
                    ) : action.priority === "immediate" ? (
                      <Zap size={12} color="#dc2626" />
                    ) : (
                      <Clock size={12} color={colors.textMuted} />
                    )}
                    <span
                      style={{
                        flex: 1,
                        textDecoration:
                          action.status === "completed" ? "line-through" : "none",
                        color:
                          action.status === "completed"
                            ? colors.textMuted
                            : colors.textPrimary,
                      }}
                    >
                      {action.description}
                    </span>
                    <Badge
                      variant={
                        action.priority === "immediate"
                          ? "danger"
                          : action.priority === "short_term"
                            ? "warning"
                            : "default"
                      }
                      size="sm"
                    >
                      {action.priority.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <Button size="sm" variant="secondary" onClick={() => setExpanded(!expanded)}>
            {expanded ? "閉じる" : "詳細"}
          </Button>
          {risk.status === "open" && (
            <Button size="sm" variant="primary" onClick={() => onAcknowledge(risk.id)}>
              確認
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RiskPriorityTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<PrioritizedRisk[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const prioritizer = useMemo(() => createRiskPrioritizer(), []);

  const loadData = useCallback(async () => {
    try {
      const storageResult = await chrome.storage.local.get(["services", "events"]);
      const services = storageResult.services
        ? (Object.values(storageResult.services) as DetectedService[])
        : [];

      // Convert services to risk inputs
      const riskInputs: RiskInput[] = services.map((s) => ({
        domain: s.domain,
        isNRD: s.nrdResult?.isNRD,
        nrdConfidence: s.nrdResult?.confidence,
        isTyposquat: s.typosquatResult?.isTyposquat,
        typosquatTarget: s.typosquatResult?.similarTo,
        hasLogin: s.hasLoginPage,
        hasPrivacyPolicy: !!s.privacyPolicyUrl,
        cookieCount: s.cookies?.length || 0,
        sessionCookies: s.cookies?.filter((c: any) => c.isSession).length || 0,
      }));

      // Prioritize risks
      const prioritizedRisks = prioritizer.prioritizeAll(riskInputs);

      // Filter out low-risk items (score < 20)
      const significantRisks = prioritizedRisks.filter((r) => r.score >= 20);

      setRisks(significantRisks);
      setSummary(prioritizer.getSummary(significantRisks));
    } catch (error) {
      console.error("Failed to load risk data:", error);
    } finally {
      setLoading(false);
    }
  }, [prioritizer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledge = useCallback((id: string) => {
    setRisks((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "acknowledged" as const } : r))
    );
  }, []);

  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (severityFilter && r.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.domain?.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [risks, searchQuery, severityFilter]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "48px", color: colors.textSecondary }}>
        リスクを分析中...
      </div>
    );
  }

  const severityOptions = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  return (
    <div>
      {/* Summary Stats */}
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
            value={summary.criticalCount}
            label="Critical"
            trend={summary.criticalCount > 0 ? { value: summary.criticalCount, isUp: true } : undefined}
          />
          <StatCard
            value={summary.highCount}
            label="High"
            trend={summary.highCount > 0 ? { value: summary.highCount, isUp: true } : undefined}
          />
          <StatCard value={summary.mediumCount} label="Medium" />
          <StatCard value={summary.lowCount} label="Low" />
          <StatCard value={summary.averageScore} label="平均スコア" />
          <StatCard value={`${summary.remediationProgress}%`} label="対処進捗" />
        </div>
      )}

      {/* Risk Trend */}
      {summary && (
        <Card title="リスクトレンド" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background:
                  summary.riskTrend.direction === "increasing"
                    ? "#dc262620"
                    : summary.riskTrend.direction === "decreasing"
                      ? "#22c55e20"
                      : colors.bgSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {summary.riskTrend.direction === "increasing" ? (
                <TrendingUp size={24} color="#dc2626" />
              ) : summary.riskTrend.direction === "decreasing" ? (
                <TrendingDown size={24} color="#22c55e" />
              ) : (
                <Minus size={24} color={colors.textMuted} />
              )}
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>
                {summary.riskTrend.direction === "increasing"
                  ? "リスク増加中"
                  : summary.riskTrend.direction === "decreasing"
                    ? "リスク減少中"
                    : "リスク安定"}
              </div>
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                過去{summary.riskTrend.comparisonPeriod === "week" ? "1週間" : "1日"}との比較
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>
                {summary.totalRisks}
              </div>
              <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                検出されたリスク
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top Categories */}
      {summary && summary.topCategories.length > 0 && (
        <Card title="リスクカテゴリ分布" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {summary.topCategories.map(({ category, count }) => (
              <div
                key={category}
                style={{
                  padding: "8px 12px",
                  background: colors.bgSecondary,
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Target size={14} color={colors.textSecondary} />
                <span style={{ fontSize: "12px" }}>
                  {category.replace(/_/g, " ")}
                </span>
                <Badge variant="default">{count}</Badge>
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
          placeholder="ドメイン、タイトルで検索..."
        />
        <Select
          value={severityFilter}
          onChange={setSeverityFilter}
          options={severityOptions}
          placeholder="重大度"
        />
        <Button size="sm" variant="secondary" onClick={loadData}>
          更新
        </Button>
      </div>

      {/* Risk List */}
      <Card title={`優先度順リスク (${filteredRisks.length})`}>
        {filteredRisks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px",
              color: colors.textMuted,
            }}
          >
            <Shield size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <div style={{ fontSize: "14px", marginBottom: "8px" }}>
              重大なリスクは検出されていません
            </div>
            <div style={{ fontSize: "12px" }}>
              ブラウジングを続けると、新しいリスクが自動的に検出されます。
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredRisks.map((risk) => (
              <RiskCard
                key={risk.id}
                risk={risk}
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
