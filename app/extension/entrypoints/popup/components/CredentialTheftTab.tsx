import { useState } from "preact/hooks";
import type { EventLog } from "@pleno-audit/detectors";
import { AlertTriangle, Lock } from "lucide-preact";
import { Badge } from "../../../components";

interface CredentialTheftTabProps {
  events: EventLog[];
}

export function CredentialTheftTab({ events }: CredentialTheftTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter credential theft events
  const credentialEvents = events.filter((e) => e.type === "credential_theft_detected");

  function getFieldType(field: string): string {
    if (field.includes("password")) return "パスワード";
    if (field.includes("email")) return "メールアドレス";
    if (field.includes("credit")) return "クレジットカード";
    if (field.includes("card")) return "カード情報";
    if (field.includes("ssn")) return "社会保障番号";
    return field;
  }

  function getRiskLevel(fields: string[]): "low" | "medium" | "high" | "critical" {
    const hasPassword = fields.some((f) => f.includes("password"));
    const hasCard = fields.some((f) => f.includes("credit") || f.includes("card"));
    const hasSSN = fields.some((f) => f.includes("ssn"));

    if (hasCard || hasSSN) return "critical";
    if (hasPassword) return "high";
    return "medium";
  }

  if (credentialEvents.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <Lock size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>認証情報送信は検出されていません</p>
        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
          フォーム送信を監視中（パスワード、カード情報など）
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          検出された送信: {credentialEvents.length}件
        </p>
        <p style={{ margin: "0", color: "#d9534f", fontSize: "12px", fontWeight: 500 }}>
          ⚠️ 認証情報の盗難リスク
        </p>
      </div>

      {credentialEvents.map((event, idx) => {
        const fields = (event.details?.fields as string[]) || [];
        const destination = (event.details?.destination as string) || "Unknown";
        const isSecure = (event.details?.secure as boolean) !== false;
        const riskLevel = getRiskLevel(fields);

        return (
          <div
            key={idx}
            style={{
              marginBottom: "12px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              background: expandedId === `cred-${idx}` ? "#f5f5f5" : "#fff",
              borderLeft: `4px solid ${riskLevel === "critical" ? "#d9534f" : riskLevel === "high" ? "#f0ad4e" : "#5bc0de"}`,
            }}
            onClick={() =>
              setExpandedId(expandedId === `cred-${idx}` ? null : `cred-${idx}`)
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, wordBreak: "break-all" }}>{destination}</div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  {fields.length}個のフィールド
                  {!isSecure && " (非HTTPS)"}
                </div>
              </div>
              <Badge variant={riskLevel} size="sm">
                {riskLevel.toUpperCase()}
              </Badge>
            </div>

            {expandedId === `cred-${idx}` && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: "12px", color: "#333", marginBottom: "8px" }}>
                  <strong>送信されたフィールド</strong>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
                    {fields.map((field, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "4px 8px",
                          margin: "4px 0",
                          background: "#f5f5f5",
                          borderRadius: "3px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#d9534f", marginRight: "8px" }}>●</span>
                        {getFieldType(field)}
                      </div>
                    ))}
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
                  <strong>セキュリティ警告</strong>
                  <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                    {!isSecure && <li>非HTTPS通信での送信</li>}
                    {fields.some((f) => f.includes("password")) && <li>パスワードが送信された</li>}
                    {fields.some((f) => f.includes("credit") || f.includes("card")) && (
                      <li>支払い情報が送信された</li>
                    )}
                    <li>フォーム送信時刻: {new Date(event.timestamp).toLocaleTimeString("ja-JP")}</li>
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
                    <li>このサイトでのパスワード変更を検討</li>
                    <li>クレジットカード会社に連絡（必要な場合）</li>
                    <li>サイトのセキュリティ証明書を確認</li>
                    <li>信頼できるサイトのみで認証情報を入力</li>
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
