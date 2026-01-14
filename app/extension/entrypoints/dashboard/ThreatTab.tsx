import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import {
  createRuntimeProtector,
  type RuntimeThreat,
  type RuntimeStats,
  type ThreatStatus,
  type MitigationActionType,
} from "@pleno-audit/runtime-protection";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Zap,
  Target,
} from "lucide-preact";
import { useTheme, getSeverityColor, spacing, type ThemeColors } from "../../lib/theme";
import { Badge, Button, Card, SearchInput, Select, StatCard, SeverityBadge, LoadingState, EmptyState, StatsGrid } from "../../components";

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "active": return colors.dot.danger;
    case "investigating": return colors.dot.warning;
    case "mitigated": return colors.dot.info;
    case "resolved": return colors.dot.success;
    case "false_positive": return colors.dot.default;
    default: return colors.dot.default;
  }
}

function StatusBadge({ status }: { status: string }) {
  const { colors } = useTheme();
  const statusColor = getStatusColor(status, colors);
  const labels: Record<string, string> = {
    active: "アクティブ",
    investigating: "調査中",
    mitigated: "対処済",
    resolved: "解決",
    false_positive: "誤検知",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "4px",
        background: `${statusColor}20`,
        color: statusColor,
      }}
    >
      {status === "active" && <Zap size={10} />}
      {status === "investigating" && <Eye size={10} />}
      {status === "mitigated" && <Shield size={10} />}
      {status === "resolved" && <CheckCircle size={10} />}
      {labels[status] || status}
    </span>
  );
}

interface ThreatCardProps {
  threat: RuntimeThreat;
  onMitigate: (id: string, action: MitigationActionType) => void;
  onUpdateStatus: (id: string, status: ThreatStatus) => void;
}

function ThreatCard({ threat, onMitigate, onUpdateStatus }: ThreatCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const severityColor = getSeverityColor(threat.severity, colors);

  const isActive = threat.status === "active" || threat.status === "investigating";

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${isActive ? severityColor : colors.border}`,
        padding: "16px",
        opacity: threat.status === "resolved" || threat.status === "false_positive" ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: `${severityColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertTriangle size={20} color={severityColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{threat.title}</span>
            <SeverityBadge severity={threat.severity} />
            <StatusBadge status={threat.status} />
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {threat.domain} • {new Date(threat.timestamp).toLocaleString("ja-JP")} • {threat.source}
          </div>
          <div style={{ fontSize: "13px", marginBottom: "8px" }}>
            {threat.description}
          </div>

          {/* Risk Factors */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
            {threat.context.riskFactors.map((factor) => (
              <span
                key={factor}
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: colors.bgSecondary,
                  color: colors.textSecondary,
                }}
              >
                {factor}
              </span>
            ))}
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
              {/* Indicators */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  脅威インジケーター
                </div>
                {threat.indicators.map((ind, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "11px",
                      color: colors.textSecondary,
                    }}
                  >
                    <Target size={10} />
                    <span>{ind.type}: {ind.value}</span>
                    <span style={{ color: colors.textMuted }}>
                      (信頼度: {Math.round(ind.confidence * 100)}%)
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  タイムライン
                </div>
                {threat.timeline.slice(0, 5).map((event, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "11px",
                      color: colors.textSecondary,
                      marginBottom: "2px",
                    }}
                  >
                    <Clock size={10} />
                    <span>{new Date(event.timestamp).toLocaleTimeString("ja-JP")}</span>
                    <span>{event.event}</span>
                  </div>
                ))}
              </div>

              {/* Mitigation Actions */}
              {threat.mitigationActions.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    対処アクション
                  </div>
                  {threat.mitigationActions.map((action) => (
                    <div
                      key={action.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "11px",
                        color: colors.textSecondary,
                      }}
                    >
                      <CheckCircle size={10} color={colors.dot.success} />
                      <span>{action.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "閉じる" : "詳細"}
          </Button>
          {isActive && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onUpdateStatus(threat.id, "resolved")}
              >
                解決
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onUpdateStatus(threat.id, "false_positive")}
              >
                誤検知
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThreatTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [threats, setThreats] = useState<RuntimeThreat[]>([]);
  const [stats, setStats] = useState<RuntimeStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const protector = useMemo(() => createRuntimeProtector(), []);

  const loadData = useCallback(async () => {
    try {
      // Get stored threats from chrome storage
      const storageResult = await chrome.storage.local.get(["runtimeThreats"]);
      const storedThreats = storageResult.runtimeThreats || [];

      // Also check for services with NRD/Typosquat flags to create threats
      const servicesResult = await chrome.storage.local.get(["services"]);
      const services = servicesResult.services
        ? Object.values(servicesResult.services) as any[]
        : [];

      // Create threats from detected services
      for (const service of services) {
        if (service.nrdResult?.isNRD) {
          await protector.detectThreat({
            source: "nrd_detector",
            domain: service.domain,
            timestamp: service.detectedAt,
            data: {
              isNRD: true,
              confidence: service.nrdResult.confidence,
            },
          });
        }
        if (service.typosquatResult?.isTyposquat) {
          await protector.detectThreat({
            source: "typosquat_detector",
            domain: service.domain,
            timestamp: service.detectedAt,
            data: {
              isTyposquat: true,
              similarTo: service.typosquatResult.similarTo,
            },
          });
        }
      }

      setThreats(await protector.getActiveThreats());
      setStats(await protector.getStats());
    } catch (error) {
      console.error("Failed to load threats:", error);
    } finally {
      setLoading(false);
    }
  }, [protector]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMitigate = useCallback(async (id: string, action: MitigationActionType) => {
    await protector.mitigateThreat(id, action);
    setThreats(await protector.getActiveThreats());
    setStats(await protector.getStats());
  }, [protector]);

  const handleUpdateStatus = useCallback(async (id: string, status: ThreatStatus) => {
    await protector.updateThreatStatus(id, status);
    setThreats(await protector.getActiveThreats());
    setStats(await protector.getStats());
  }, [protector]);

  const filteredThreats = useMemo(() => {
    return threats.filter((t) => {
      if (severityFilter && t.severity !== severityFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.domain.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [threats, searchQuery, severityFilter, statusFilter]);

  if (loading) {
    return <LoadingState message="脅威データを読み込み中..." />;
  }

  const severityOptions = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const statusOptions = [
    { value: "active", label: "アクティブ" },
    { value: "investigating", label: "調査中" },
    { value: "mitigated", label: "対処済" },
    { value: "resolved", label: "解決" },
  ];

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{ marginBottom: spacing.xl }}>
          <StatsGrid>
            <StatCard
              value={stats.activeThreats}
              label="アクティブな脅威"
              trend={stats.activeThreats > 0 ? { value: stats.activeThreats, isUp: true } : undefined}
            />
            <StatCard
              value={stats.threatsToday}
              label="本日検出"
            />
            <StatCard
              value={stats.threatsThisWeek}
              label="今週検出"
            />
            <StatCard
              value={stats.mitigatedThreats}
              label="対処済み"
            />
            <StatCard
              value={stats.openIncidents}
              label="インシデント"
            />
          </StatsGrid>
        </div>
      )}

      {/* Severity Distribution */}
      {stats && (
        <Card title="脅威の深刻度分布" style={{ marginBottom: spacing.xl }}>
          <div style={{ display: "flex", gap: spacing.xl, alignItems: "center" }}>
            {Object.entries(stats.threatsBySeverity).map(([severity, count]) => (
              <div key={severity} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: getSeverityColor(severity, colors),
                  }}
                >
                  {count}
                </div>
                <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                  {severity}
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
          placeholder="ドメイン、タイトルで検索..."
        />
        <Select
          value={severityFilter}
          onChange={setSeverityFilter}
          options={severityOptions}
          placeholder="深刻度"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          placeholder="ステータス"
        />
        <Button size="sm" variant="secondary" onClick={loadData}>
          更新
        </Button>
      </div>

      {/* Threats List */}
      <Card title={`検出された脅威 (${filteredThreats.length})`}>
        {filteredThreats.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="アクティブな脅威はありません"
            description="リアルタイム監視が有効です。脅威が検出されると自動的に表示されます。"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredThreats.map((threat) => (
              <ThreatCard
                key={threat.id}
                threat={threat}
                onMitigate={handleMitigate}
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Top Threat Domains */}
      {stats && stats.topThreatDomains.length > 0 && (
        <Card title="脅威ドメイン (上位)" style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {stats.topThreatDomains.slice(0, 5).map(({ domain, count }) => (
              <div
                key={domain}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: colors.bgSecondary,
                  borderRadius: "6px",
                }}
              >
                <code style={{ fontSize: "12px" }}>{domain}</code>
                <Badge variant="danger">{count}件</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
