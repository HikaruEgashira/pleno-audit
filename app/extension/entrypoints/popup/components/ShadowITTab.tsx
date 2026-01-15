import { useState } from "preact/hooks";
import type { DetectedService, EventLog, CapturedAIPrompt } from "@pleno-audit/detectors";
import { AlertCircle, Globe } from "lucide-preact";
import { Badge } from "../../../components";

interface ShadowITTabProps {
  services: DetectedService[];
  events: EventLog[];
  aiPrompts: CapturedAIPrompt[];
}

export function ShadowITTab({ services, events, aiPrompts }: ShadowITTabProps) {
  const [expandedService, setExpandedService] = useState<string | null>(null);

  // Filter events related to Shadow IT (login_detected, cookie_set, etc.)
  const shadowITEvents = events.filter((e) =>
    ["login_detected", "cookie_set", "privacy_policy_found", "terms_of_service_found"].includes(
      e.type
    )
  );

  // Filter AI prompts by service
  const serviceAIPrompts = aiPrompts.reduce(
    (acc, prompt) => {
      if (!acc[prompt.domain]) acc[prompt.domain] = [];
      acc[prompt.domain].push(prompt);
      return acc;
    },
    {} as Record<string, CapturedAIPrompt[]>
  );

  if (services.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", color: "#888" }}>
        <Globe size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
        <p>未承認サービスが検出されていません</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
        <p style={{ margin: "0 0 4px", color: "#666", fontSize: "12px" }}>
          検出されたサービス: {services.length}個
        </p>
        <p style={{ margin: "0", color: "#666", fontSize: "12px" }}>
          関連イベント: {shadowITEvents.length}件
        </p>
      </div>

      {services.map((service) => (
        <div
          key={service.domain}
          style={{
            marginBottom: "12px",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            background: expandedService === service.domain ? "#f5f5f5" : "#fff",
          }}
          onClick={() =>
            setExpandedService(expandedService === service.domain ? null : service.domain)
          }
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, wordBreak: "break-all" }}>{service.domain}</div>
              <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                初回検出: {new Date(service.firstSeen).toLocaleDateString("ja-JP")}
              </div>
            </div>
            <Badge variant="info" size="sm">
              {service.detectionMethods?.length || 0}
            </Badge>
          </div>

          {expandedService === service.domain && (
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
              {service.hasLoginPage && (
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                  <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} />
                  ログインページ検出
                </div>
              )}

              {service.privacyPolicyUrl && (
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                  <a
                    href={service.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0066cc", textDecoration: "none" }}
                  >
                    プライバシーポリシー
                  </a>
                </div>
              )}

              {service.termsOfServiceUrl && (
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                  <a
                    href={service.termsOfServiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0066cc", textDecoration: "none" }}
                  >
                    利用規約
                  </a>
                </div>
              )}

              {serviceAIPrompts[service.domain]?.length > 0 && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#d9534f",
                    marginTop: "8px",
                    padding: "8px",
                    background: "#f8d7da",
                    borderRadius: "4px",
                  }}
                >
                  AI送信: {serviceAIPrompts[service.domain].length}件
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
