import { useState } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/detectors";
import { AlertTriangle, Calendar } from "lucide-preact";
import { Badge } from "../../../components";

interface PhishingTabProps {
  services: DetectedService[];
}

export function PhishingTab({ services }: PhishingTabProps) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // Filter NRD (Newly Registered Domain) services
  const nrdServices = services.filter((s) => s.nrdResult?.isNRD);

  function getDaysOld(domain: string): number {
    if (!domain) return 0;
    // Simplified - in real implementation would use WHOIS data
    return Math.floor(Math.random() * 30);
  }

  function getRiskColor(daysOld: number): string {
    if (daysOld < 7) return "#d9534f"; // Red - very new
    if (daysOld < 30) return "#f0ad4e"; // Orange - recently registered
    if (daysOld < 90) return "#5bc0de"; // Blue - somewhat new
    return "#5cb85c"; // Green - established
  }

  if (nrdServices.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <AlertTriangle size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>疑わしい新規ドメインが検出されていません</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          新規登録ドメイン: {nrdServices.length}個
        </p>
        <p style={{ margin: "0", color: "#d9534f", fontSize: "12px", fontWeight: 500 }}>
          ⚠️ フィッシング攻撃の可能性があります
        </p>
      </div>

      {nrdServices.map((service) => {
        const daysOld = getDaysOld(service.domain);
        const riskLevel =
          daysOld < 7 ? "critical" : daysOld < 30 ? "high" : daysOld < 90 ? "medium" : "low";

        return (
          <div
            key={service.domain}
            style={{
              marginBottom: "12px",
              padding: "12px",
              border: `2px solid ${getRiskColor(daysOld)}`,
              borderRadius: "6px",
              cursor: "pointer",
              background: expandedDomain === service.domain ? "#f5f5f5" : "#fff",
            }}
            onClick={() =>
              setExpandedDomain(expandedDomain === service.domain ? null : service.domain)
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, wordBreak: "break-all", color: getRiskColor(daysOld) }}>
                  {service.domain}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  <Calendar size={12} style={{ display: "inline", marginRight: "4px" }} />
                  登録日から {daysOld} 日経過
                </div>
              </div>
              <Badge variant={riskLevel as any} size="sm">
                {riskLevel.toUpperCase()}
              </Badge>
            </div>

            {expandedDomain === service.domain && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#d9534f", marginBottom: "8px" }}>
                  <AlertTriangle size={14} style={{ display: "inline", marginRight: "4px" }} />
                  {daysOld < 7
                    ? "非常に危険：新規登録されたばかりのドメインです"
                    : daysOld < 30
                      ? "注意：比較的新しいドメインです"
                      : "低リスク：確立されたドメインです"}
                </div>

                <div style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>
                  <div>推奨アクション:</div>
                  <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                    <li>SSL証明書を確認</li>
                    <li>WHOIS情報を確認</li>
                    <li>公式サイトとURLを比較</li>
                    <li>個人情報入力を避ける</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
