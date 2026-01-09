import { useState } from "preact/hooks";
import type { GeneratedCSPPolicy } from "@service-policy-controller/core";
import { styles } from "../styles";

export function PolicyGenerator() {
  const [policy, setPolicy] = useState<GeneratedCSPPolicy | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: "GENERATE_CSP",
        data: { options: { strictMode: false, includeReportUri: true } },
      });
      setPolicy(result);
    } catch (err) {
      console.error("Failed to generate policy:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!policy) return;
    try {
      await navigator.clipboard.writeText(policy.policyString);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  if (!policy) {
    return (
      <div style={styles.section}>
        <p style={{ ...styles.emptyText, marginBottom: "12px" }}>
          Generate a CSP policy from collected violations and network requests
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

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Generated Policy</h3>

      <div
        style={{
          backgroundColor: "hsl(0 0% 95%)",
          padding: "12px",
          borderRadius: "3px",
          marginBottom: "12px",
          maxHeight: "200px",
          overflow: "auto",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontSize: "11px",
            fontFamily: "'Menlo', monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all" as const,
            color: "hsl(0 0% 20%)",
            lineHeight: 1.4,
          }}
        >
          {policy.policyString}
        </pre>
      </div>

      <button
        onClick={handleCopy}
        style={{
          ...styles.button,
          padding: "6px 12px",
          fontSize: "12px",
          marginRight: "8px",
        }}
      >
        Copy to Clipboard
      </button>

      <button onClick={() => setPolicy(null)} style={styles.buttonSecondary}>
        Clear
      </button>

      {policy.recommendations.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <h4 style={{ ...styles.sectionTitle, marginTop: "12px" }}>
            Recommendations ({policy.recommendations.length})
          </h4>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px" }}>
            {policy.recommendations.slice(0, 10).map((rec, i) => (
              <li
                key={i}
                style={{
                  marginBottom: "6px",
                  color:
                    rec.severity === "critical"
                      ? "hsl(0 70% 50%)"
                      : "hsl(0 0% 40%)",
                }}
              >
                <strong
                  style={{ textTransform: "uppercase", fontSize: "10px" }}
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
  );
}
