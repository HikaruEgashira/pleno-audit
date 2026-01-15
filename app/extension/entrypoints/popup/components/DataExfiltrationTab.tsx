import { useState } from "preact/hooks";
import type { EventLog } from "@pleno-audit/detectors";
import type { NetworkRequest } from "@pleno-audit/csp";
import { AlertTriangle, Download } from "lucide-preact";
import { Badge } from "../../../components";

interface DataExfiltrationTabProps {
  events: EventLog[];
  networkRequests: NetworkRequest[];
}

export function DataExfiltrationTab({ events, networkRequests }: DataExfiltrationTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter data exfiltration events
  const exfiltrationEvents = events.filter((e) => e.type === "data_exfiltration_detected");

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getRiskLevel(sizeBytes: number): "low" | "medium" | "high" | "critical" {
    if (sizeBytes > 10 * 1024 * 1024) return "critical";
    if (sizeBytes > 5 * 1024 * 1024) return "high";
    if (sizeBytes > 1 * 1024 * 1024) return "medium";
    return "low";
  }

  if (exfiltrationEvents.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <Download size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>大量データ転送が検出されていません</p>
        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
          100KB以上のデータ転送を監視中
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          検出された転送: {exfiltrationEvents.length}件
        </p>
        <p style={{ margin: "0", color: "#d9534f", fontSize: "12px", fontWeight: 500 }}>
          ⚠️ 機密データ漏洩の可能性があります
        </p>
      </div>

      {exfiltrationEvents.map((event, idx) => {
        const sizeBytes = (event.details?.size as number) || 0;
        const riskLevel = getRiskLevel(sizeBytes);
        const destination = (event.details?.destination as string) || "Unknown";
        const method = (event.details?.method as string) || "Unknown";

        return (
          <div
            key={idx}
            style={{
              marginBottom: "12px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              background: expandedId === `exfil-${idx}` ? "#f5f5f5" : "#fff",
              borderLeft: `4px solid ${riskLevel === "critical" ? "#d9534f" : riskLevel === "high" ? "#f0ad4e" : "#5bc0de"}`,
            }}
            onClick={() =>
              setExpandedId(expandedId === `exfil-${idx}` ? null : `exfil-${idx}`)
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>
                  {formatBytes(sizeBytes)} - {method}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px", wordBreak: "break-all" }}>
                  {destination}
                </div>
              </div>
              <Badge variant={riskLevel} size="sm">
                {riskLevel.toUpperCase()}
              </Badge>
            </div>

            {expandedId === `exfil-${idx}` && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#333", marginBottom: "8px" }}>
                  <strong>転送詳細</strong>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                    <div>方法: {method}</div>
                    <div>宛先: {destination}</div>
                    <div>サイズ: {formatBytes(sizeBytes)}</div>
                    <div>時刻: {new Date(event.timestamp).toLocaleTimeString("ja-JP")}</div>
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
                  <strong>リスク評価</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                    {sizeBytes > 5 * 1024 * 1024 && <li>大規模データ転送が発生</li>}
                    {method.toUpperCase() === "FETCH" && <li>Fetch API による転送</li>}
                    {method.toUpperCase() === "XHR" && <li>XMLHttpRequest による転送</li>}
                    {method.toUpperCase() === "BEACON" && <li>ビーコン API による転送</li>}
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
                    <li>このドメインへのデータ送信をブロック</li>
                    <li>送信データ内容を確認</li>
                    <li>必要に応じてセキュリティ調査を実施</li>
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
