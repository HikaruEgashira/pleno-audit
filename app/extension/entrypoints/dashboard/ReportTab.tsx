import { useState, useCallback, useMemo } from "preact/hooks";
import {
  exportData,
  downloadExport,
  type SecurityReport,
  type ServiceExport,
  type ViolationExport,
  type AlertExport,
  type PermissionExport,
} from "@pleno-audit/data-export";
import {
  FileText,
  Download,
  FileJson,
  FileSpreadsheet,
  FileCode,
  Calendar,
  Shield,
  AlertTriangle,
  Eye,
  CheckCircle,
} from "lucide-preact";
import { useTheme } from "../../lib/theme";
import { Badge, Button, Card, Select, StatCard } from "../../components";

type ReportPeriod = "7d" | "30d" | "90d" | "all";
type ExportFormat = "json" | "csv" | "markdown" | "html";

function getPeriodLabel(period: ReportPeriod): string {
  switch (period) {
    case "7d": return "過去7日";
    case "30d": return "過去30日";
    case "90d": return "過去90日";
    case "all": return "全期間";
  }
}

function getPeriodMs(period: ReportPeriod): number {
  const now = Date.now();
  switch (period) {
    case "7d": return now - 7 * 24 * 60 * 60 * 1000;
    case "30d": return now - 30 * 24 * 60 * 60 * 1000;
    case "90d": return now - 90 * 24 * 60 * 60 * 1000;
    case "all": return 0;
  }
}

export function ReportTab() {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const periodOptions = [
    { value: "7d", label: "過去7日" },
    { value: "30d", label: "過去30日" },
    { value: "90d", label: "過去90日" },
    { value: "all", label: "全期間" },
  ];

  const generateReport = useCallback(async (): Promise<SecurityReport> => {
    const startTime = getPeriodMs(period);
    const endTime = Date.now();

    // Fetch all data from storage
    const storageResult = await chrome.storage.local.get([
      "services",
      "events",
      "runtimeThreats",
      "policyViolations",
    ]);

    const services = storageResult.services
      ? (Object.values(storageResult.services) as any[])
      : [];

    // Filter by period
    const filteredServices = services.filter(
      (s) => s.detectedAt >= startTime
    );

    // Calculate security score
    const nrdCount = filteredServices.filter((s) => s.nrdResult?.isNRD).length;
    const typosquatCount = filteredServices.filter(
      (s) => s.typosquatResult?.isTyposquat
    ).length;
    const securityScore = Math.max(
      0,
      100 - nrdCount * 20 - typosquatCount * 30
    );

    // Build service exports
    const serviceExports: ServiceExport[] = filteredServices.map((s) => ({
      domain: s.domain,
      firstSeen: s.detectedAt,
      lastSeen: s.detectedAt,
      hasLogin: s.hasLoginPage || false,
      hasPrivacyPolicy: !!s.privacyPolicyUrl,
      hasTermsOfService: !!s.termsOfServiceUrl,
      isNRD: s.nrdResult?.isNRD || false,
      nrdConfidence: s.nrdResult?.confidence,
      isTyposquat: s.typosquatResult?.isTyposquat || false,
      typosquatConfidence: s.typosquatResult?.confidence,
      cookieCount: s.cookies?.length || 0,
      riskScore: calculateRiskScore(s),
    }));

    // Build violation exports
    const violations: ViolationExport[] = [];
    if (storageResult.policyViolations) {
      for (const v of storageResult.policyViolations as any[]) {
        if (v.timestamp >= startTime) {
          violations.push({
            id: v.id,
            type: v.ruleName || v.type,
            domain: v.domain,
            severity: v.severity,
            description: v.description,
            timestamp: v.timestamp,
            acknowledged: v.acknowledged || false,
          });
        }
      }
    }

    // Build alert exports
    const alerts: AlertExport[] = [];
    if (storageResult.runtimeThreats) {
      for (const t of storageResult.runtimeThreats as any[]) {
        if (t.timestamp >= startTime) {
          alerts.push({
            id: t.id,
            title: t.title,
            severity: t.severity,
            category: t.type,
            description: t.description,
            domain: t.domain,
            timestamp: t.timestamp,
            status: t.status,
          });
        }
      }
    }

    // Build permission exports (from installed extensions)
    const permissions: PermissionExport[] = [];
    try {
      const extensions = await chrome.management.getAll();
      for (const ext of extensions) {
        if (ext.type === "extension") {
          const riskScore = calculateExtensionRiskScore(ext);
          permissions.push({
            extensionId: ext.id,
            extensionName: ext.name,
            riskScore,
            riskLevel: riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low",
            permissions: ext.permissions || [],
            findingsCount: ext.permissions?.length || 0,
            analyzedAt: Date.now(),
          });
        }
      }
    } catch {
      // Extension API not available
    }

    // Build risk distribution
    const riskDistribution: Record<string, number> = {
      critical: serviceExports.filter((s) => s.riskScore >= 80).length,
      high: serviceExports.filter((s) => s.riskScore >= 60 && s.riskScore < 80).length,
      medium: serviceExports.filter((s) => s.riskScore >= 40 && s.riskScore < 60).length,
      low: serviceExports.filter((s) => s.riskScore >= 20 && s.riskScore < 40).length,
      minimal: serviceExports.filter((s) => s.riskScore < 20).length,
    };

    // Build top risks
    const topRisks: string[] = [];
    if (nrdCount > 0) topRisks.push(`${nrdCount}件のNRDサイトへのアクセス`);
    if (typosquatCount > 0) topRisks.push(`${typosquatCount}件のタイポスクワット検出`);
    if (violations.length > 0) topRisks.push(`${violations.length}件のポリシー違反`);
    if (alerts.length > 0) topRisks.push(`${alerts.length}件のセキュリティアラート`);

    return {
      metadata: {
        generatedAt: Date.now(),
        reportPeriod: {
          start: startTime,
          end: endTime,
        },
        version: "1.0.0",
        exportFormat: "json",
      },
      summary: {
        totalServices: serviceExports.length,
        totalViolations: violations.length,
        totalAlerts: alerts.length,
        securityScore,
        riskDistribution,
        topRisks,
      },
      services: serviceExports,
      violations,
      alerts,
      permissions,
      compliance: {
        framework: "SOC2",
        overallScore: securityScore,
        controlsPassed: securityScore >= 80 ? 10 : securityScore >= 60 ? 7 : 5,
        controlsFailed: securityScore >= 80 ? 0 : securityScore >= 60 ? 3 : 5,
        controls: [],
      },
    };
  }, [period]);

  function calculateRiskScore(service: any): number {
    let score = 0;
    if (service.nrdResult?.isNRD) score += 40;
    if (service.typosquatResult?.isTyposquat) score += 50;
    if (service.hasLoginPage && !service.privacyPolicyUrl) score += 20;
    if (!service.termsOfServiceUrl) score += 5;
    return Math.min(100, score);
  }

  function calculateExtensionRiskScore(ext: chrome.management.ExtensionInfo): number {
    let score = 0;
    const perms = ext.permissions || [];
    if (perms.includes("<all_urls>") || ext.hostPermissions?.includes("<all_urls>")) score += 30;
    if (perms.includes("webRequest")) score += 15;
    if (perms.includes("webRequestBlocking")) score += 25;
    if (perms.includes("cookies")) score += 15;
    if (perms.includes("history")) score += 15;
    if (perms.includes("tabs")) score += 10;
    return Math.min(100, score);
  }

  const handleExport = useCallback(async (format: ExportFormat) => {
    setGenerating(true);
    try {
      const report = await generateReport();

      if (format === "json") {
        const result = exportData(report, {
          format: "json",
          dataType: "full_report",
          prettyPrint: true,
        });
        downloadExport(result);
      } else if (format === "csv") {
        // Export services as CSV
        const result = exportData(report.services, {
          format: "csv",
          dataType: "services",
        });
        downloadExport(result);
      } else if (format === "markdown") {
        const result = exportData(report, {
          format: "markdown",
          dataType: "full_report",
        });
        downloadExport(result);
      } else if (format === "html") {
        const result = exportData(report, {
          format: "html",
          dataType: "full_report",
        });
        downloadExport(result);
      }

      setLastGenerated(new Date().toLocaleString("ja-JP"));
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setGenerating(false);
    }
  }, [generateReport]);

  return (
    <div>
      {/* Report Configuration */}
      <Card title="レポート生成" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={16} color={colors.textSecondary} />
            <span style={{ fontSize: "13px" }}>期間:</span>
          </div>
          <Select
            value={period}
            onChange={(v) => setPeriod(v as ReportPeriod)}
            options={periodOptions}
          />
        </div>

        <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "16px" }}>
          レポートには以下の情報が含まれます:
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
          {[
            { icon: Shield, label: "セキュリティスコア" },
            { icon: Eye, label: "検出サービス" },
            { icon: AlertTriangle, label: "脅威・違反" },
            { icon: CheckCircle, label: "権限分析" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                background: colors.bgSecondary,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            >
              <Icon size={14} color={colors.textSecondary} />
              {label}
            </div>
          ))}
        </div>

        {lastGenerated && (
          <div style={{ fontSize: "11px", color: colors.textMuted, marginBottom: "16px" }}>
            最終生成: {lastGenerated}
          </div>
        )}
      </Card>

      {/* Export Formats */}
      <Card title="エクスポート形式">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {/* JSON Export */}
          <div
            style={{
              padding: "16px",
              background: colors.bgSecondary,
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <FileJson size={20} color="#3b82f6" />
              <span style={{ fontWeight: 600 }}>JSON</span>
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "12px" }}>
              構造化データ。プログラムでの処理やAPI連携に最適。
            </div>
            <Button
              onClick={() => handleExport("json")}
              disabled={generating}
              size="sm"
            >
              <Download size={14} style={{ marginRight: "6px" }} />
              {generating ? "生成中..." : "JSONで出力"}
            </Button>
          </div>

          {/* CSV Export */}
          <div
            style={{
              padding: "16px",
              background: colors.bgSecondary,
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <FileSpreadsheet size={20} color="#22c55e" />
              <span style={{ fontWeight: 600 }}>CSV</span>
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "12px" }}>
              表形式データ。Excel/Googleスプレッドシートで分析可能。
            </div>
            <Button
              onClick={() => handleExport("csv")}
              disabled={generating}
              size="sm"
              variant="secondary"
            >
              <Download size={14} style={{ marginRight: "6px" }} />
              {generating ? "生成中..." : "CSVで出力"}
            </Button>
          </div>

          {/* Markdown Export */}
          <div
            style={{
              padding: "16px",
              background: colors.bgSecondary,
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <FileCode size={20} color="#8b5cf6" />
              <span style={{ fontWeight: 600 }}>Markdown</span>
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "12px" }}>
              テキストベースレポート。ドキュメントやWikiに適切。
            </div>
            <Button
              onClick={() => handleExport("markdown")}
              disabled={generating}
              size="sm"
              variant="secondary"
            >
              <Download size={14} style={{ marginRight: "6px" }} />
              {generating ? "生成中..." : "MDで出力"}
            </Button>
          </div>

          {/* HTML Export */}
          <div
            style={{
              padding: "16px",
              background: colors.bgSecondary,
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <FileText size={20} color="#f97316" />
              <span style={{ fontWeight: 600 }}>HTML</span>
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "12px" }}>
              ビジュアルレポート。ブラウザで閲覧、印刷可能。
            </div>
            <Button
              onClick={() => handleExport("html")}
              disabled={generating}
              size="sm"
              variant="secondary"
            >
              <Download size={14} style={{ marginRight: "6px" }} />
              {generating ? "生成中..." : "HTMLで出力"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Scheduled Reports (Future Feature) */}
      <Card title="定期レポート" style={{ marginTop: "24px" }}>
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: colors.textMuted,
          }}
        >
          <Calendar size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
          <div style={{ fontSize: "14px", marginBottom: "8px" }}>
            定期レポート機能は近日公開予定です
          </div>
          <div style={{ fontSize: "12px" }}>
            週次・月次レポートの自動生成とメール送信機能を準備中です。
          </div>
        </div>
      </Card>
    </div>
  );
}
