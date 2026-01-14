import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/detectors";
import {
  createPolicyEngine,
  type PolicyViolation,
  type PolicyRule,
  type PolicyContext,
} from "@pleno-audit/policy-engine";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Settings,
} from "lucide-preact";
import { useTheme, getSeverityColor, spacing } from "../../lib/theme";
import { Badge, Button, Card, SearchInput, Select, StatCard, SeverityBadge, LoadingState, EmptyState, StatsGrid } from "../../components";

interface ViolationCardProps {
  violation: PolicyViolation;
  onAcknowledge: (id: string) => void;
}

function ViolationCard({ violation, onAcknowledge }: ViolationCardProps) {
  const { colors } = useTheme();
  const severityColor = getSeverityColor(violation.severity, colors);

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${violation.acknowledged ? colors.border : severityColor}`,
        padding: "16px",
        opacity: violation.acknowledged ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <AlertTriangle
          size={20}
          color={violation.acknowledged ? colors.textSecondary : severityColor}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{violation.ruleName}</span>
            <SeverityBadge severity={violation.severity} />
            {violation.acknowledged && (
              <Badge variant="default" size="sm">
                <CheckCircle size={10} style={{ marginRight: "4px" }} />
                確認済
              </Badge>
            )}
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {violation.domain} • {new Date(violation.timestamp).toLocaleString("ja-JP")}
          </div>
          <div style={{ fontSize: "13px", marginBottom: "8px" }}>
            {violation.description}
          </div>
          <div style={{
            fontSize: "12px",
            padding: "8px",
            background: colors.bgSecondary,
            borderRadius: "4px",
            borderLeft: `3px solid ${severityColor}`,
          }}>
            <strong>対策:</strong> {violation.remediation}
          </div>
        </div>
        {!violation.acknowledged && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAcknowledge(violation.id)}
          >
            確認
          </Button>
        )}
      </div>
    </div>
  );
}

interface PolicyCardProps {
  policy: PolicyRule;
  onToggle: (id: string, enabled: boolean) => void;
}

function PolicyCard({ policy, onToggle }: PolicyCardProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${colors.border}`,
        padding: "12px",
        opacity: policy.enabled ? 1 : 0.6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: policy.enabled ? colors.dot.success : colors.dot.default,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 500, fontSize: "13px" }}>{policy.name}</span>
            <SeverityBadge severity={policy.severity} />
          </div>
          <div style={{ fontSize: "11px", color: colors.textSecondary }}>
            {policy.description}
          </div>
        </div>
        <Button
          size="sm"
          variant={policy.enabled ? "primary" : "secondary"}
          onClick={() => onToggle(policy.id, !policy.enabled)}
        >
          {policy.enabled ? "有効" : "無効"}
        </Button>
      </div>
    </div>
  );
}

export function PolicyTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [activeView, setActiveView] = useState<"violations" | "policies">("violations");

  const engine = useMemo(() => createPolicyEngine(), []);

  const loadData = useCallback(async () => {
    try {
      const storageResult = await chrome.storage.local.get(["services"]);
      const services = storageResult.services
        ? (Object.values(storageResult.services) as DetectedService[])
        : [];

      // Evaluate each service against policies
      for (const service of services) {
        const context: PolicyContext = {
          domain: service.domain,
          isNRD: service.nrdResult?.isNRD ?? false,
          isTyposquat: service.typosquatResult?.isTyposquat ?? false,
          hasLogin: service.hasLoginPage ?? false,
          hasPrivacyPolicy: !!service.privacyPolicyUrl,
          hasTermsOfService: !!service.termsOfServiceUrl,
          cookieCount: service.cookies?.length ?? 0,
        };
        engine.evaluate(context);
      }

      setViolations(engine.getViolations());
      setPolicies(engine.getPolicies());
      setStats(engine.getViolationStats());
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledge = useCallback((id: string) => {
    engine.acknowledgeViolation(id);
    setViolations(engine.getViolations());
    setStats(engine.getViolationStats());
  }, [engine]);

  const handleAcknowledgeAll = useCallback(() => {
    engine.acknowledgeAll();
    setViolations(engine.getViolations());
    setStats(engine.getViolationStats());
  }, [engine]);

  const handleTogglePolicy = useCallback((id: string, enabled: boolean) => {
    engine.setPolityEnabled(id, enabled);
    setPolicies(engine.getPolicies());
  }, [engine]);

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (!showAcknowledged && v.acknowledged) return false;
      if (severityFilter && v.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.domain.toLowerCase().includes(q) ||
          v.ruleName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [violations, searchQuery, severityFilter, showAcknowledged]);

  if (loading) {
    return <LoadingState message="ポリシーを評価中..." />;
  }

  const severityOptions = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={{ marginBottom: spacing.xl }}>
        <StatsGrid minWidth="sm">
          <StatCard
            value={stats.total || 0}
            label="未対応"
            trend={stats.total > 0 ? { value: stats.total, isUp: true } : undefined}
          />
          <StatCard
            value={stats.critical || 0}
            label="Critical"
            trend={stats.critical > 0 ? { value: stats.critical, isUp: true } : undefined}
          />
          <StatCard value={stats.high || 0} label="High" />
          <StatCard value={stats.medium || 0} label="Medium" />
          <StatCard value={policies.filter((p) => p.enabled).length} label="有効ポリシー" />
        </StatsGrid>
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <Button
          variant={activeView === "violations" ? "primary" : "secondary"}
          onClick={() => setActiveView("violations")}
        >
          <AlertTriangle size={14} style={{ marginRight: "6px" }} />
          違反 ({stats.total || 0})
        </Button>
        <Button
          variant={activeView === "policies" ? "primary" : "secondary"}
          onClick={() => setActiveView("policies")}
        >
          <Settings size={14} style={{ marginRight: "6px" }} />
          ポリシー ({policies.length})
        </Button>
      </div>

      {activeView === "violations" && (
        <>
          {/* Filters */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="ドメイン、ルール名で検索..."
            />
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              options={severityOptions}
              placeholder="重大度"
            />
            <Button
              size="sm"
              variant={showAcknowledged ? "primary" : "secondary"}
              onClick={() => setShowAcknowledged(!showAcknowledged)}
            >
              確認済みを表示
            </Button>
            {stats.total > 0 && (
              <Button size="sm" variant="secondary" onClick={handleAcknowledgeAll}>
                すべて確認
              </Button>
            )}
          </div>

          {/* Violations */}
          <Card title={`ポリシー違反 (${filteredViolations.length})`}>
            {filteredViolations.length === 0 ? (
              <EmptyState
                icon={Shield}
                title={showAcknowledged ? "違反は記録されていません" : "未対応の違反はありません"}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredViolations.map((v) => (
                  <ViolationCard
                    key={v.id}
                    violation={v}
                    onAcknowledge={handleAcknowledge}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {activeView === "policies" && (
        <Card title={`セキュリティポリシー (${policies.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {policies.map((p) => (
              <PolicyCard key={p.id} policy={p} onToggle={handleTogglePolicy} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
