import { useMemo, useState } from "preact/hooks";
import type { DetectedService, CapturedAIPrompt } from "@pleno-audit/detectors";
import type { CSPViolation } from "@pleno-audit/csp";
import type { DoHRequestRecord } from "@pleno-audit/extension-runtime";
import type { AlertSeverity, AlertCategory } from "@pleno-audit/detectors";
import { analyzePromptPII, assessPromptRisk } from "@pleno-audit/detectors";
import { Badge, Button } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface ThreatTabProps {
  services: DetectedService[];
  violations: CSPViolation[];
  aiPrompts: CapturedAIPrompt[];
  doHRequests: DoHRequestRecord[];
}

interface ThreatItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  domain: string;
  timestamp: number;
}

function convertToThreats(
  services: DetectedService[],
  violations: CSPViolation[],
  aiPrompts: CapturedAIPrompt[],
  doHRequests: DoHRequestRecord[]
): ThreatItem[] {
  const threats: ThreatItem[] = [];

  for (const service of services) {
    if (service.nrdResult?.isNRD) {
      const age = service.nrdResult.domainAge;
      threats.push({
        id: `nrd-${service.domain}`,
        category: "nrd",
        severity: age !== null && age < 7 ? "critical" : "high",
        title: service.domain,
        domain: service.domain,
        timestamp: service.lastVisit || Date.now(),
      });
    }
    if (service.typosquatResult?.isTyposquat) {
      const score = service.typosquatResult.score || 0;
      threats.push({
        id: `typosquat-${service.domain}`,
        category: "typosquat",
        severity: score >= 0.9 ? "critical" : score >= 0.7 ? "high" : "medium",
        title: service.domain,
        domain: service.domain,
        timestamp: service.lastVisit || Date.now(),
      });
    }
  }

  for (const prompt of aiPrompts) {
    const pii = analyzePromptPII(prompt.prompt);
    if (pii.hasSensitiveData) {
      const risk = assessPromptRisk(prompt.prompt);
      if (risk.riskLevel !== "info" && risk.riskLevel !== "low") {
        threats.push({
          id: `ai-${prompt.id}`,
          category: "ai_sensitive",
          severity: risk.riskLevel,
          title: prompt.provider || new URL(prompt.apiEndpoint).hostname,
          domain: new URL(prompt.apiEndpoint).hostname,
          timestamp: prompt.timestamp,
        });
      }
    }
  }

  for (const v of violations.slice(0, 50)) {
    threats.push({
      id: `csp-${v.timestamp}-${v.blockedURL}`,
      category: "csp_violation",
      severity: v.directive === "script-src" || v.directive === "default-src" ? "high" : "medium",
      title: v.directive,
      domain: new URL(v.pageUrl).hostname,
      timestamp: new Date(v.timestamp).getTime(),
    });
  }

  for (const r of doHRequests.slice(0, 20)) {
    threats.push({
      id: `doh-${r.id}`,
      category: "shadow_ai",
      severity: r.blocked ? "high" : "medium",
      title: r.domain,
      domain: r.domain,
      timestamp: r.timestamp,
    });
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function getSeverityVariant(sev: AlertSeverity): "danger" | "warning" | "info" | "default" {
  switch (sev) {
    case "critical": case "high": return "danger";
    case "medium": return "warning";
    case "low": return "info";
    default: return "default";
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  nrd: "NRD",
  typosquat: "Typosquat",
  ai_sensitive: "AI",
  csp_violation: "CSP",
  shadow_ai: "DoH",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function ThreatTab({ services, violations, aiPrompts, doHRequests }: ThreatTabProps) {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const threats = useMemo(
    () => convertToThreats(services, violations, aiPrompts, doHRequests),
    [services, violations, aiPrompts, doHRequests]
  );

  const counts = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const t of threats) {
      byCat[t.category] = (byCat[t.category] || 0) + 1;
    }
    return byCat;
  }, [threats]);

  const filtered = useMemo(() => {
    if (!searchQuery) return threats;
    const q = searchQuery.toLowerCase();
    // Category filter
    if (["nrd", "typosquat", "ai", "csp", "doh"].includes(q)) {
      const catMap: Record<string, string> = { nrd: "nrd", typosquat: "typosquat", ai: "ai_sensitive", csp: "csp_violation", doh: "shadow_ai" };
      return threats.filter((t) => t.category === catMap[q]);
    }
    // Severity filter
    if (["critical", "high", "medium"].includes(q)) {
      return threats.filter((t) => t.severity === q);
    }
    // Text search
    return threats.filter((t) => t.title.toLowerCase().includes(q) || t.domain.toLowerCase().includes(q));
  }, [threats, searchQuery]);

  if (threats.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>脅威は検出されていません</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Filter Bar */}
      <div style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <input
          type="text"
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          placeholder="検索..."
          style={{
            flex: 1,
            minWidth: "120px",
            padding: "6px 10px",
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            fontSize: "12px",
            background: colors.bgPrimary,
            color: colors.textPrimary,
            outline: "none",
          }}
        />
        {counts.nrd > 0 && (
          <Button
            variant={searchQuery === "nrd" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "nrd" ? "" : "nrd")}
          >
            NRD ({counts.nrd})
          </Button>
        )}
        {counts.typosquat > 0 && (
          <Button
            variant={searchQuery === "typosquat" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "typosquat" ? "" : "typosquat")}
          >
            Typosquat ({counts.typosquat})
          </Button>
        )}
        {counts.csp_violation > 0 && (
          <Button
            variant={searchQuery === "csp" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSearchQuery(searchQuery === "csp" ? "" : "csp")}
          >
            CSP ({counts.csp_violation})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
        <table style={{ ...styles.table, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "64px" }} />
            <col style={{ width: "72px" }} />
            <col />
            <col style={{ width: "48px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.tableHeader}>Severity</th>
              <th style={styles.tableHeader}>Category</th>
              <th style={styles.tableHeader}>Target</th>
              <th style={{ ...styles.tableHeader, textAlign: "right" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((t) => (
              <tr key={t.id} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <Badge variant={getSeverityVariant(t.severity)} size="sm">{t.severity}</Badge>
                </td>
                <td style={styles.tableCell}>
                  <Badge size="sm">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                </td>
                <td style={{ ...styles.tableCell, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <code style={{ ...styles.code, background: "transparent", padding: 0 }} title={t.title}>{t.title}</code>
                </td>
                <td style={{ ...styles.tableCell, textAlign: "right", fontFamily: "monospace", fontSize: "11px", color: colors.textMuted }}>
                  {formatTime(t.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div style={{ padding: "8px", textAlign: "center", fontSize: "11px", color: colors.textMuted, borderTop: `1px solid ${colors.borderLight}` }}>
            +{filtered.length - 100} more
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: colors.textMuted }}>
            該当する脅威がありません
          </div>
        )}
      </div>
    </div>
  );
}
