import { useState } from "preact/hooks";
import type { EventLog } from "@pleno-audit/detectors";
import { Shield, Lock } from "lucide-preact";
import { Badge } from "../../../components";

interface PolicyEnforcementTabProps {
  events: EventLog[];
}

export function PolicyEnforcementTab({ events }: PolicyEnforcementTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter policy enforcement events
  const policyEvents = events.filter((e) => e.type === "policy_violation" || e.type === "policy_enforced");

  function getAction(action: string): { label: string; color: string } {
    if (action === "block") return { label: "ブロック", color: "#d9534f" };
    if (action === "warn") return { label: "警告", color: "#f0ad4e" };
    if (action === "allow") return { label: "許可", color: "#5cb85c" };
    return { label: "その他", color: "#5bc0de" };
  }

  function getPolicyType(type: string): string {
    if (type.includes("domain")) return "ドメインポリシー";
    if (type.includes("tool")) return "ツール/サービス";
    if (type.includes("ai")) return "AI サービス";
    if (type.includes("data")) return "データ転送";
    return "セキュリティポリシー";
  }

  if (policyEvents.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <Shield size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>ポリシー適用イベントなし</p>
        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
          セキュリティポリシーの遵守状況を監視中
        </p>
      </div>
    );
  }

  // Group by policy type
  const policyByType: Record<string, typeof policyEvents> = {};
  policyEvents.forEach((event) => {
    const type = getPolicyType(event.details?.policyType as string);
    if (!policyByType[type]) policyByType[type] = [];
    policyByType[type].push(event);
  });

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          ポリシーイベント: {policyEvents.length}件
        </p>
        <p style={{ margin: "0", color: "#666", fontSize: "12px" }}>
          ポリシータイプ: {Object.keys(policyByType).length}種類
        </p>
      </div>

      {Object.entries(policyByType).map(([policyType, typedEvents]) => (
        <div
          key={policyType}
          style={{
            marginBottom: "12px",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              fontWeight: 500,
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{policyType}</span>
            <Badge variant="info" size="sm">
              {typedEvents.length}件
            </Badge>
          </div>

          {typedEvents.map((event, idx) => {
            const action = getAction(event.details?.action as string);
            const target = (event.details?.target as string) || "Unknown";
            const reason = (event.details?.reason as string) || "Policy enforcement";

            return (
              <div
                key={idx}
                style={{
                  marginBottom: "8px",
                  padding: "8px",
                  background: "#f5f5f5",
                  borderRadius: "4px",
                  borderLeft: `3px solid ${action.color}`,
                  cursor: "pointer",
                }}
                onClick={() =>
                  setExpandedId(
                    expandedId === `policy-${policyType}-${idx}` ? null : `policy-${policyType}-${idx}`
                  )
                }
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", wordBreak: "break-all", color: "#333" }}>
                      {target}
                    </div>
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                      {new Date(event.timestamp).toLocaleTimeString("ja-JP")}
                    </div>
                  </div>
                  <Badge
                    variant={
                      action.label === "ブロック" ? "danger" : action.label === "警告" ? "warning" : "success"
                    }
                    size="sm"
                  >
                    {action.label}
                  </Badge>
                </div>

                {expandedId === `policy-${policyType}-${idx}` && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #ddd" }}>
                    <div style={{ fontSize: "11px", color: "#666" }}>
                      <div style={{ marginBottom: "4px" }}>
                        <strong>理由:</strong> {reason}
                      </div>
                      <div style={{ marginBottom: "4px" }}>
                        <strong>ルール:</strong> {event.details?.rule as string || "Default"}
                      </div>
                      {event.details?.details && (
                        <div>
                          <strong>詳細:</strong>{" "}
                          {typeof event.details.details === "string"
                            ? event.details.details
                            : JSON.stringify(event.details.details)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
        <Lock size={14} style={{ display: "inline", marginRight: "4px" }} />
        <strong>ポリシー管理</strong>
        <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
          <li>セキュリティポリシーが有効です</li>
          <li>ブロックされたアクセスは記録されています</li>
          <li>警告されたアクションを確認してください</li>
          <li>必要に応じてポリシーを調整</li>
        </ul>
      </div>
    </div>
  );
}
