import { useState } from "preact/hooks";
import type { EventLog } from "@pleno-audit/detectors";
import { AlertCircle, CheckCircle } from "lucide-preact";
import { Badge } from "../../../components";

interface ComplianceTabProps {
  events: EventLog[];
}

export function ComplianceTab({ events }: ComplianceTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter compliance events
  const cookiePolicyEvents = events.filter((e) => e.type === "cookie_policy_found");
  const cookieBannerEvents = events.filter((e) => e.type === "cookie_banner_detected");

  const totalComplianceEvents = cookiePolicyEvents.length + cookieBannerEvents.length;

  function getFrameworkCompliance(site: string): {
    gdpr: boolean;
    ccpa: boolean;
    status: "compliant" | "partial" | "non-compliant";
  } {
    // Simplified - in real implementation would check actual policies
    const hasPolicy = cookiePolicyEvents.some((e) => {
      const domain = e.details?.domain as string;
      return domain === site;
    });

    const hasBanner = cookieBannerEvents.some((e) => {
      const domain = e.details?.domain as string;
      return domain === site;
    });

    return {
      gdpr: hasBanner,
      ccpa: hasPolicy,
      status: hasBanner && hasPolicy ? "compliant" : hasBanner || hasPolicy ? "partial" : "non-compliant",
    };
  }

  if (totalComplianceEvents === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <CheckCircle size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>コンプライアンス関連の検出なし</p>
        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
          GDPR、CCPA等の準拠状況を監視中
        </p>
      </div>
    );
  }

  const allSites = new Set<string>();
  cookiePolicyEvents.forEach((e) => allSites.add(e.details?.domain as string));
  cookieBannerEvents.forEach((e) => allSites.add(e.details?.domain as string));

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          検出されたサイト: {allSites.size}個
        </p>
        <p style={{ margin: "0 0 2px", color: "#666", fontSize: "12px" }}>
          クッキーポリシー: {cookiePolicyEvents.length}
        </p>
        <p style={{ margin: "0", color: "#666", fontSize: "12px" }}>
          クッキーバナー: {cookieBannerEvents.length}
        </p>
      </div>

      {Array.from(allSites).map((site) => {
        const compliance = getFrameworkCompliance(site);
        const siteEvents = [
          ...cookiePolicyEvents.filter((e) => e.details?.domain === site),
          ...cookieBannerEvents.filter((e) => e.details?.domain === site),
        ];

        return (
          <div
            key={site}
            style={{
              marginBottom: "12px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              background: expandedId === site ? "#f5f5f5" : "#fff",
              borderLeft: `4px solid ${compliance.status === "compliant" ? "#5cb85c" : compliance.status === "partial" ? "#f0ad4e" : "#d9534f"}`,
            }}
            onClick={() =>
              setExpandedId(expandedId === site ? null : site)
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, wordBreak: "break-all" }}>{site}</div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  イベント: {siteEvents.length}件
                </div>
              </div>
              <Badge
                variant={
                  compliance.status === "compliant" ? "success" : compliance.status === "partial" ? "warning" : "danger"
                }
                size="sm"
              >
                {compliance.status === "compliant" ? "準拠" : compliance.status === "partial" ? "部分的" : "未準拠"}
              </Badge>
            </div>

            {expandedId === site && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#333", marginBottom: "8px" }}>
                  <strong>フレームワーク準拠状況</strong>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                    <div style={{ padding: "4px", margin: "4px 0", background: "#f5f5f5", borderRadius: "3px" }}>
                      <span style={{ color: compliance.gdpr ? "#5cb85c" : "#d9534f", marginRight: "8px" }}>
                        {compliance.gdpr ? "✓" : "✗"}
                      </span>
                      GDPR (EU): {compliance.gdpr ? "バナー検出" : "未検出"}
                    </div>
                    <div style={{ padding: "4px", margin: "4px 0", background: "#f5f5f5", borderRadius: "3px" }}>
                      <span style={{ color: compliance.ccpa ? "#5cb85c" : "#d9534f", marginRight: "8px" }}>
                        {compliance.ccpa ? "✓" : "✗"}
                      </span>
                      CCPA (US): {compliance.ccpa ? "ポリシー検出" : "未検出"}
                    </div>
                  </div>
                </div>

                {siteEvents.map((event, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "11px",
                      padding: "8px",
                      marginBottom: "8px",
                      background: "#f9f9f9",
                      borderRadius: "4px",
                      borderLeft: `3px solid ${event.type === "cookie_banner_detected" ? "#5bc0de" : "#f0ad4e"}`,
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "#333" }}>
                      {event.type === "cookie_banner_detected" ? "クッキーバナー" : "クッキーポリシー"}
                    </div>
                    <div style={{ color: "#666", marginTop: "4px" }}>
                      {new Date(event.timestamp).toLocaleTimeString("ja-JP")}
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    fontSize: "11px",
                    color: "#555",
                    marginTop: "12px",
                    padding: "8px",
                    background: "#f0f7ff",
                    borderRadius: "4px",
                  }}
                >
                  <strong>推奨アクション:</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                    {!compliance.gdpr && <li>GDPR対応のバナーを確認</li>}
                    {!compliance.ccpa && <li>CCPA対応のポリシーを確認</li>}
                    <li>クッキー設定を見直し</li>
                    <li>ユーザー同意を確保</li>
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
