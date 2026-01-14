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
  XCircle,
  Clock,
  Eye,
  Zap,
  Target,
  Activity,
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

function getStatusColor(status: string): string {
  switch (status) {
    case "active": return "#dc2626";
    case "investigating": return "#f97316";
    case "mitigated": return "#3b82f6";
    case "resolved": return "#22c55e";
    case "false_positive": return "#6b7280";
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
  return <Badge variant={variants[severity] || "default"}>{severity}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
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
        background: `${getStatusColor(status)}20`,
        color: getStatusColor(status),
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

  const isActive = threat.status === "active" || threat.status === "investigating";

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${isActive ? getSeverityColor(threat.severity) : colors.border}`,
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
            background: `${getSeverityColor(threat.severity)}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertTriangle size={20} color={getSeverityColor(threat.severity)} />
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
                      <CheckCircle size={10} color="#22c55e" />
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
    return (
      <div style={{ textAlign: "center", padding: "48px", color: colors.textSecondary }}>
        脅威データを読み込み中...
      </div>
    );
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
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
        </div>
      )}

      {/* Severity Distribution */}
      {stats && (
        <Card title="脅威の深刻度分布" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            {Object.entries(stats.threatsBySeverity).map(([severity, count]) => (
              <div key={severity} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: getSeverityColor(severity),
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
          <div
            style={{
              textAlign: "center",
              padding: "48px",
              color: colors.textMuted,
            }}
          >
            <Shield size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <div style={{ fontSize: "14px", marginBottom: "8px" }}>
              アクティブな脅威はありません
            </div>
            <div style={{ fontSize: "12px" }}>
              リアルタイム監視が有効です。脅威が検出されると自動的に表示されます。
            </div>
          </div>
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
