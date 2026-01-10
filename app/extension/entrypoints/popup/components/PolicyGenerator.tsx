import { useState } from "preact/hooks";
import type { GeneratedCSPPolicy } from "@service-policy-auditor/csp";
import { styles } from "../styles";

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
    } catch (err) {
      console.error("Failed to generate policy:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(policyString: string) {
    try {
      await navigator.clipboard.writeText(policyString);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  if (!result) {
    return (
      <div style={styles.section}>
        <p style={{ ...styles.emptyText, marginBottom: "12px" }}>
          Generate CSP policies grouped by source domain
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            ...styles.button,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Generating..." : "Generate CSP Policy"}
        </button>
      </div>
    );
  }

  if (result.policies.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No data collected yet</p>
        <button onClick={() => setResult(null)} style={styles.buttonSecondary}>
          Clear
        </button>
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
          CSP ({result.totalDomains})
        </h3>
        <button onClick={() => setResult(null)} style={styles.buttonSecondary}>
          Clear
        </button>
      </div>

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
        />
      ))}
    </div>
  );
}

function DomainPolicyCard({
  item,
  expanded,
  onToggle,
  onCopy,
}: {
  item: DomainCSPPolicy;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid hsl(0 0% 85%)",
        borderRadius: "4px",
        marginBottom: "8px",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          backgroundColor: expanded ? "hsl(0 0% 95%)" : "hsl(0 0% 98%)",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid hsl(0 0% 85%)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "hsl(0 0% 50%)" }}>
            {expanded ? "▼" : "▶"}
          </span>
          <span
            style={{
              fontFamily: "'Menlo', monospace",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            {item.domain}
          </span>
        </div>
        <span
          style={{
            fontSize: "11px",
            color: "hsl(0 0% 50%)",
            backgroundColor: "hsl(0 0% 90%)",
            padding: "2px 6px",
            borderRadius: "10px",
          }}
        >
          {item.reportCount} requests
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "12px" }}>
          <div
            style={{
              backgroundColor: "hsl(0 0% 95%)",
              padding: "10px",
              borderRadius: "3px",
              marginBottom: "10px",
              maxHeight: "150px",
              overflow: "auto",
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: "10px",
                fontFamily: "'Menlo', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all" as const,
                color: "hsl(0 0% 20%)",
                lineHeight: 1.4,
              }}
            >
              {item.policy.policyString}
            </pre>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            style={{
              ...styles.button,
              padding: "4px 10px",
              fontSize: "11px",
            }}
          >
            Copy
          </button>

          {item.policy.recommendations.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <h4
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "hsl(0 0% 30%)",
                  marginBottom: "6px",
                }}
              >
                Recommendations ({item.policy.recommendations.length})
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "14px",
                  fontSize: "10px",
                  lineHeight: 1.6,
                }}
              >
                {item.policy.recommendations.slice(0, 5).map((rec, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: "4px",
                      color:
                        rec.severity === "critical"
                          ? "hsl(0 70% 50%)"
                          : "hsl(0 0% 40%)",
                    }}
                  >
                    <strong
                      style={{ textTransform: "uppercase", fontSize: "9px" }}
                    >
                      {rec.severity}
                    </strong>{" "}
                    <span style={{ fontFamily: "'Menlo', monospace" }}>
                      {rec.directive}
                    </span>
                    : {rec.message}
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
