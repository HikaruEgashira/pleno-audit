import { useState } from "preact/hooks";
import type { EventLog } from "@pleno-audit/detectors";
import { AlertTriangle, Link as LinkIcon } from "lucide-preact";
import { Badge } from "../../../components";

interface SupplyChainTabProps {
  events: EventLog[];
}

export function SupplyChainTab({ events }: SupplyChainTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter supply chain risk events
  const supplyChainEvents = events.filter((e) => e.type === "supply_chain_risk_detected");

  function getRiskLevel(reason: string): "low" | "medium" | "high" | "critical" {
    if (reason.includes("SRI")) return "high";
    if (reason.includes("Unknown")) return "medium";
    if (reason.includes("suspicious")) return "critical";
    return "medium";
  }

  function getSourceType(url: string): string {
    if (url.includes("cdnjs")) return "cdnjs";
    if (url.includes("jsdelivr")) return "jsdelivr";
    if (url.includes("unpkg")) return "unpkg";
    if (url.includes("cdn")) return "CDN";
    if (url.includes(".js")) return "JavaScript";
    if (url.includes(".css")) return "Stylesheet";
    return "Resource";
  }

  if (supplyChainEvents.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <LinkIcon size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>サプライチェーンリスクが検出されていません</p>
        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
          外部スクリプト・ライブラリを監視中
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          検出されたリスク: {supplyChainEvents.length}件
        </p>
        <p style={{ margin: "0", color: "#d9534f", fontSize: "12px", fontWeight: 500 }}>
          ⚠️ サプライチェーン攻撃の可能性
        </p>
      </div>

      {supplyChainEvents.map((event, idx) => {
        const url = (event.details?.url as string) || "Unknown";
        const reason = (event.details?.reason as string) || "Unknown";
        const hasValidSRI = (event.details?.sri as boolean) || false;
        const riskLevel = getRiskLevel(reason);
        const sourceType = getSourceType(url);

        return (
          <div
            key={idx}
            style={{
              marginBottom: "12px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              background: expandedId === `supply-${idx}` ? "#f5f5f5" : "#fff",
              borderLeft: `4px solid ${riskLevel === "critical" ? "#d9534f" : riskLevel === "high" ? "#f0ad4e" : "#5bc0de"}`,
            }}
            onClick={() =>
              setExpandedId(expandedId === `supply-${idx}` ? null : `supply-${idx}`)
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{sourceType}</div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px", wordBreak: "break-all" }}>
                  {url}
                </div>
              </div>
              <Badge variant={riskLevel} size="sm">
                {riskLevel.toUpperCase()}
              </Badge>
            </div>

            {expandedId === `supply-${idx}` && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#333", marginBottom: "8px" }}>
                  <strong>セキュリティ情報</strong>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                    <div style={{ padding: "4px", margin: "4px 0", background: "#f5f5f5", borderRadius: "3px" }}>
                      <span style={{ color: hasValidSRI ? "#5cb85c" : "#d9534f", marginRight: "8px" }}>
                        {hasValidSRI ? "✓" : "✗"}
                      </span>
                      SRI (Subresource Integrity): {hasValidSRI ? "検証済み" : "未検証"}
                    </div>
                    <div style={{ padding: "4px", margin: "4px 0", background: "#f5f5f5", borderRadius: "3px" }}>
                      <span style={{ color: "#5bc0de", marginRight: "8px" }}>●</span>
                      理由: {reason}
                    </div>
                    <div style={{ padding: "4px", margin: "4px 0", background: "#f5f5f5", borderRadius: "3px" }}>
                      <span style={{ color: "#888", marginRight: "8px" }}>⏱</span>
                      検出: {new Date(event.timestamp).toLocaleTimeString("ja-JP")}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    color: "#d9534f",
                    marginTop: "12px",
                    padding: "8px",
                    background: "#f8d7da",
                    borderRadius: "4px",
                  }}
                >
                  <AlertTriangle size={14} style={{ display: "inline", marginRight: "4px" }} />
                  <strong>リスク分析</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                    {!hasValidSRI && <li>SRI検証がないため改ざんの危険あり</li>}
                    {sourceType.includes("CDN") && <li>CDN経由のリソース - 信頼性確認が重要</li>}
                    {reason.includes("Unknown") && <li>不明なソースからのリソース</li>}
                    <li>このライブラリの版を確認</li>
                  </ul>
                </div>

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
                    <li>SRI ハッシュを確認・設定</li>
                    <li>ライブラリの最新版を使用</li>
                    <li>信頼できるソースから取得</li>
                    <li>定期的に依存関係を監査</li>
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
