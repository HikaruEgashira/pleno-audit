import { useState } from "preact/hooks";
import type { ExtensionAnalysis } from "@pleno-audit/permission-analyzer";
import { Shield, AlertTriangle } from "lucide-preact";
import { useTheme } from "../../../../lib/theme";
import { Button } from "../../../../components";
import { RiskBadge, getRiskColor } from "./RiskBadge";

interface ExtensionCardProps {
  analysis: ExtensionAnalysis;
}

export function ExtensionCard({ analysis }: ExtensionCardProps) {
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
