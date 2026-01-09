import { useState, useEffect } from "preact/hooks";
import type { GeneratedCSPPolicy } from "@ai-service-exposure/core";

export function PolicyGenerator() {
  const [policy, setPolicy] = useState<GeneratedCSPPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [strictMode, setStrictMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generatePolicy();
  }, [strictMode]);

  async function generatePolicy() {
    setLoading(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: "GENERATE_CSP",
        data: { options: { strictMode } },
      });
      setPolicy(result);
    } catch (error) {
      console.error("Failed to generate CSP:", error);
    }
    setLoading(false);
  }

  async function copyPolicy() {
    if (!policy) return;
    try {
      await navigator.clipboard.writeText(policy.policyString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  if (loading) {
    return <p style={styles.loading}>Generating policy...</p>;
  }

  if (!policy) {
    return <p style={styles.empty}>No data to generate policy</p>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={strictMode}
            onChange={(e) => setStrictMode((e.target as HTMLInputElement).checked)}
          />
          <span>Strict Mode</span>
        </label>
        <button style={styles.copyBtn} onClick={copyPolicy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div style={styles.stats}>
        <span>Violations: {policy.statistics.cspViolations}</span>
        <span>Requests: {policy.statistics.networkRequests}</span>
        <span>Domains: {policy.statistics.uniqueDomains.length}</span>
      </div>

      <div style={styles.policyBox}>
        <code style={styles.policy}>{policy.policyString}</code>
      </div>

      {policy.recommendations.length > 0 && (
        <div style={styles.recommendations}>
          <h4 style={styles.recTitle}>Recommendations</h4>
          {policy.recommendations.slice(0, 3).map((rec, i) => (
            <div key={i} style={styles.rec}>
              <span style={getSeverityStyle(rec.severity)}>{rec.severity}</span>
              <span style={styles.recMsg}>{rec.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getSeverityStyle(severity: string): React.CSSProperties {
  const colors: Record<string, string> = {
    critical: "hsl(0 70% 50%)",
    high: "hsl(30 70% 50%)",
    medium: "hsl(45 70% 45%)",
    low: "hsl(210 50% 50%)",
  };
  return {
    ...styles.severity,
    color: colors[severity] || colors.medium,
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "12px",
  },
  loading: {
    textAlign: "center",
    padding: "40px 20px",
    color: "hsl(0 0% 50%)",
    fontSize: "13px",
  },
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "hsl(0 0% 50%)",
    fontSize: "13px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  copyBtn: {
    padding: "6px 12px",
    fontSize: "11px",
    border: "1px solid hsl(0 0% 85%)",
    borderRadius: "4px",
    background: "white",
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: "12px",
    fontSize: "11px",
    color: "hsl(0 0% 50%)",
    marginBottom: "12px",
  },
  policyBox: {
    background: "hsl(0 0% 97%)",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "12px",
    maxHeight: "120px",
    overflow: "auto",
  },
  policy: {
    fontSize: "11px",
    fontFamily: "monospace",
    wordBreak: "break-all",
    lineHeight: 1.5,
  },
  recommendations: {
    borderTop: "1px solid hsl(0 0% 92%)",
    paddingTop: "12px",
  },
  recTitle: {
    fontSize: "12px",
    fontWeight: 600,
    margin: "0 0 8px 0",
    color: "hsl(0 0% 30%)",
  },
  rec: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    fontSize: "11px",
    marginBottom: "6px",
  },
  severity: {
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  recMsg: {
    color: "hsl(0 0% 40%)",
    flex: 1,
  },
};
