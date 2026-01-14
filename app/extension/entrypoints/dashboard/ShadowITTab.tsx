import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/detectors";
import {
  createShadowITDetector,
  type DetectedShadowIT,
  type ShadowITSummary,
  type ServiceCategory,
} from "@pleno-audit/shadow-it";
import {
  Cloud,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
  Code,
  FileText,
  Bot,
  Users,
} from "lucide-preact";
import { useTheme } from "../../lib/theme";
import { Badge, Button, Card, SearchInput, Select, StatCard } from "../../components";

const categoryIcons: Record<ServiceCategory, typeof Cloud> = {
  storage: Cloud,
  collaboration: MessageSquare,
  development: Code,
  productivity: FileText,
  communication: MessageSquare,
  ai: Bot,
  analytics: FileText,
  marketing: FileText,
  finance: FileText,
  hr: Users,
  security: Shield,
  social: Users,
  entertainment: FileText,
  other: FileText,
};

const categoryLabels: Record<ServiceCategory, string> = {
  storage: "ストレージ",
  collaboration: "コラボレーション",
  development: "開発",
  productivity: "生産性",
  communication: "コミュニケーション",
  ai: "AI",
  analytics: "アナリティクス",
  marketing: "マーケティング",
  finance: "ファイナンス",
  hr: "HR",
  security: "セキュリティ",
  social: "ソーシャル",
  entertainment: "エンターテイメント",
  other: "その他",
};

function getRiskColor(risk: string): string {
  switch (risk) {
    case "critical":
      return "#dc2626";
    case "high":
      return "#f97316";
    case "medium":
      return "#eab308";
    case "low":
      return "#22c55e";
    default:
      return "#6b7280";
  }
}

function RiskBadge({ level }: { level: string }) {
  const variants: Record<string, "danger" | "warning" | "info" | "success" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "success",
    info: "default",
  };
  return <Badge variant={variants[level] || "default"}>{level}</Badge>;
}

interface ServiceCardProps {
  service: DetectedShadowIT;
  onApprove: (id: string) => void;
}

function ServiceCard({ service, onApprove }: ServiceCardProps) {
  const { colors } = useTheme();
  const Icon = categoryIcons[service.category] || Cloud;

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${service.approved ? colors.border : getRiskColor(service.riskLevel)}`,
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: colors.bgSecondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: service.approved ? colors.textSecondary : getRiskColor(service.riskLevel),
          }}
        >
          <Icon size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{service.serviceName}</span>
            <RiskBadge level={service.riskLevel} />
            {service.approved ? (
              <Badge variant="success" size="sm">
                <CheckCircle size={10} style={{ marginRight: "4px" }} />
                承認済
              </Badge>
            ) : (
              <Badge variant="default" size="sm">
                <XCircle size={10} style={{ marginRight: "4px" }} />
                未承認
              </Badge>
            )}
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {categoryLabels[service.category]} • {service.domain}
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: colors.textSecondary }}>
            <span>アクセス: {service.accessCount}回</span>
            <span>初検出: {new Date(service.detectedAt).toLocaleDateString("ja-JP")}</span>
            <span>最終: {new Date(service.lastSeenAt).toLocaleDateString("ja-JP")}</span>
          </div>
          {(service.dataExposure.hasUploadedFiles || service.dataExposure.hasEnteredCredentials || service.dataExposure.hasSentPII) && (
            <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
              {service.dataExposure.hasUploadedFiles && (
                <Badge variant="warning" size="sm">ファイルアップロード</Badge>
              )}
              {service.dataExposure.hasEnteredCredentials && (
                <Badge variant="danger" size="sm">認証情報入力</Badge>
              )}
              {service.dataExposure.hasSentPII && (
                <Badge variant="danger" size="sm">PII送信</Badge>
              )}
            </div>
          )}
        </div>
        {!service.approved && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onApprove(service.serviceId)}
          >
            承認
          </Button>
        )}
      </div>
    </div>
  );
}

export function ShadowITTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<DetectedShadowIT[]>([]);
  const [summary, setSummary] = useState<ShadowITSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");

  const detector = useMemo(() => createShadowITDetector(), []);

  const loadData = useCallback(async () => {
    try {
      // Get services from storage and detect shadow IT
      const storageResult = await chrome.storage.local.get(["services"]);
      const detectedServices = storageResult.services
        ? (Object.values(storageResult.services) as DetectedService[])
        : [];

      // Process each service through shadow IT detector
      for (const service of detectedServices) {
        await detector.processVisit(service.domain, {
          hasEnteredCredentials: service.hasLoginPage,
        });
      }

      const shadowITServices = await detector.getDetectedServices();
      const shadowITSummary = await detector.getSummary();

      setServices(shadowITServices);
      setSummary(shadowITSummary);
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, [detector]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleApprove = useCallback(async (serviceId: string) => {
    await detector.approveService(serviceId);
    await loadData();
  }, [detector, loadData]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (riskFilter && s.riskLevel !== riskFilter) return false;
      if (approvalFilter === "approved" && !s.approved) return false;
      if (approvalFilter === "unapproved" && s.approved) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.serviceName.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [services, searchQuery, categoryFilter, riskFilter, approvalFilter]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "48px", color: colors.textSecondary }}>
        Shadow ITを検出中...
      </div>
    );
  }

  if (!summary || services.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px", color: colors.textSecondary }}>
        Shadow ITサービスは検出されていません。
      </div>
    );
  }

  const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({
    value,
    label,
  }));

  const riskOptions = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const approvalOptions = [
    { value: "approved", label: "承認済み" },
    { value: "unapproved", label: "未承認" },
  ];

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <StatCard value={summary.totalServices} label="検出サービス" />
        <StatCard
          value={summary.unapprovedServices}
          label="未承認"
          trend={
            summary.unapprovedServices > 0
              ? { value: summary.unapprovedServices, isUp: true }
              : undefined
          }
        />
        <StatCard
          value={summary.criticalRiskServices}
          label="Critical"
          trend={
            summary.criticalRiskServices > 0
              ? { value: summary.criticalRiskServices, isUp: true }
              : undefined
          }
        />
        <StatCard value={summary.highRiskServices} label="High Risk" />
        <StatCard value={summary.approvedServices} label="承認済み" />
      </div>

      {/* Category Distribution */}
      <Card title="カテゴリ分布" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {Object.entries(summary.byCategory)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => {
              const Icon = categoryIcons[category as ServiceCategory] || Cloud;
              return (
                <div
                  key={category}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: colors.bgSecondary,
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setCategoryFilter(categoryFilter === category ? "" : category)
                  }
                >
                  <Icon size={14} />
                  <span style={{ fontSize: "12px" }}>
                    {categoryLabels[category as ServiceCategory]}
                  </span>
                  <Badge size="sm">{count}</Badge>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Top Risks */}
      {summary.topRisks.length > 0 && (
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={16} color={getRiskColor("critical")} />
              高リスクサービス
            </span>
          }
          style={{ marginBottom: "24px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {summary.topRisks.map((service) => (
              <div
                key={service.serviceId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 12px",
                  background: colors.bgSecondary,
                  borderRadius: "6px",
                  borderLeft: `3px solid ${getRiskColor(service.riskLevel)}`,
                }}
              >
                <span style={{ fontWeight: 500, flex: 1 }}>{service.serviceName}</span>
                <Badge variant="default" size="sm">
                  {categoryLabels[service.category]}
                </Badge>
                <RiskBadge level={service.riskLevel} />
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
          flexWrap: "wrap",
        }}
      >
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="サービス名で検索..."
        />
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
          placeholder="カテゴリ"
        />
        <Select
          value={riskFilter}
          onChange={setRiskFilter}
          options={riskOptions}
          placeholder="リスク"
        />
        <Select
          value={approvalFilter}
          onChange={setApprovalFilter}
          options={approvalOptions}
          placeholder="承認状態"
        />
      </div>

      {/* Service List */}
      <Card title={`サービス一覧 (${filteredServices.length})`}>
        {filteredServices.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "24px", color: colors.textMuted }}
          >
            該当するサービスがありません
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
              gap: "12px",
            }}
          >
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.serviceId}
                service={service}
                onApprove={handleApprove}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
