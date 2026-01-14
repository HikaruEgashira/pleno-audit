import { useState } from "preact/hooks";
import type { GeneratedCSPPolicy } from "@pleno-audit/csp";
import { Badge, Button } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface DomainCSPPolicy {
  domain: string;
  policy: GeneratedCSPPolicy;
  reportCount: number;
}

interface GeneratedCSPByDomain {
  policies: DomainCSPPolicy[];
  totalDomains: number;
}

export function PolicyGenerator() {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [result, setResult] = useState<GeneratedCSPByDomain | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      const data = await chrome.runtime.sendMessage({
        type: "GENERATE_CSP_BY_DOMAIN",
        data: { options: { strictMode: false, includeReportUri: true } },
      });
      setResult(data);
      if (data?.policies?.length > 0) {
        setExpandedDomain(data.policies[0].domain);
      }
    } catch {
      // Failed to generate policy
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(policyString: string) {
    try {
      await navigator.clipboard.writeText(policyString);
      alert("クリップボードにコピーしました");
    } catch {
      // Failed to copy
    }
  }

  if (!result) {
    return (
      <div style={styles.section}>
        <p style={{ ...styles.emptyText, marginBottom: "12px" }}>
          ドメイン別にCSPポリシーを生成
        </p>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          variant="primary"
        >
          {loading ? "生成中..." : "CSPポリシーを生成"}
        </Button>
      </div>
    );
  }

  if (result.policies.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>データがまだ収集されていません</p>
        <Button onClick={() => setResult(null)} variant="secondary">
          クリア
        </Button>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h3 style={{ ...styles.sectionTitle, margin: 0 }}>
          CSPポリシー ({result.totalDomains})
        </h3>
        <Button onClick={() => setResult(null)} variant="ghost" size="sm">
          クリア
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {result.policies.map((item) => (
          <DomainPolicyCard
            key={item.domain}
            item={item}
            expanded={expandedDomain === item.domain}
            onToggle={() =>
              setExpandedDomain(
                expandedDomain === item.domain ? null : item.domain
              )
            }
            onCopy={() => handleCopy(item.policy.policyString)}
            styles={styles}
            colors={colors}
          />
        ))}
      </div>
    </div>
  );
}

function DomainPolicyCard({
  item,
  expanded,
  onToggle,
  onCopy,
  styles,
  colors,
}: {
  item: DomainCSPPolicy;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  styles: ReturnType<typeof usePopupStyles>;
  colors: any;
}) {
  return (
    <div style={styles.card}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: colors.textSecondary }}>
            {expanded ? "▼" : "▶"}
          </span>
          <code style={styles.code}>{item.domain}</code>
        </div>
        <Badge>{item.reportCount}件</Badge>
      </div>

      {expanded && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colors.border}` }}>
          <div
            style={{
              backgroundColor: colors.bgSecondary,
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "10px",
              maxHeight: "150px",
              overflow: "auto",
              border: `1px solid ${colors.border}`,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: "10px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all" as const,
                color: colors.textPrimary,
                lineHeight: 1.4,
              }}
            >
              {item.policy.policyString}
            </pre>
          </div>

          <Button
            onClick={(e: Event) => {
              e.stopPropagation();
              onCopy();
            }}
            variant="secondary"
            size="sm"
          >
            コピー
          </Button>

          {item.policy.recommendations.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <h4
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: colors.textSecondary,
                  marginBottom: "8px",
                }}
              >
                推奨事項 ({item.policy.recommendations.length})
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "14px",
                  fontSize: "11px",
                  lineHeight: 1.6,
                }}
              >
                {item.policy.recommendations.slice(0, 5).map((rec, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: "4px",
                      color: rec.severity === "critical" ? colors.status.danger.text : colors.textSecondary,
                    }}
                  >
                    <Badge variant={rec.severity === "critical" ? "danger" : "warning"} size="sm">
                      {rec.severity === "critical" ? "重要" : "警告"}
                    </Badge>{" "}
                    <code style={{ fontSize: "10px" }}>{rec.directive}</code>: {rec.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
