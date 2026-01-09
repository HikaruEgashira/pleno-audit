import { useState, useEffect } from "preact/hooks";
import type { CSPConfig } from "@ai-service-exposure/core";

export function Settings() {
  const [config, setConfig] = useState<CSPConfig | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const cfg = await chrome.runtime.sendMessage({ type: "GET_CSP_CONFIG" });
      setConfig(cfg);
      setEndpoint(cfg?.reportEndpoint ?? "");
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      await chrome.runtime.sendMessage({
        type: "SET_CSP_CONFIG",
        data: {
          ...config,
          reportEndpoint: endpoint || null,
        },
      });
      setMessage("Settings saved!");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Failed to save config:", error);
      setMessage("Failed to save");
    }
    setSaving(false);
  }

  async function handleClearData() {
    if (!confirm("Clear all CSP data?")) return;
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      setMessage("Data cleared!");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Failed to clear data:", error);
    }
  }

  if (!config) {
    return <p style={styles.loading}>Loading...</p>;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>CSP Auditor Settings</h3>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) =>
            setConfig({ ...config, enabled: (e.target as HTMLInputElement).checked })
          }
        />
        <span>Enable CSP Auditing</span>
      </label>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={config.collectCSPViolations}
          onChange={(e) =>
            setConfig({
              ...config,
              collectCSPViolations: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <span>Collect CSP Violations</span>
      </label>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={config.collectNetworkRequests}
          onChange={(e) =>
            setConfig({
              ...config,
              collectNetworkRequests: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <span>Collect Network Requests</span>
      </label>

      <div style={styles.field}>
        <label style={styles.label}>Report Endpoint (optional)</label>
        <input
          type="url"
          style={styles.input}
          value={endpoint}
          onChange={(e) => setEndpoint((e.target as HTMLInputElement).value)}
          placeholder="https://your-server.com/api/reports"
        />
      </div>

      <div style={styles.actions}>
        <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <button style={styles.clearBtn} onClick={handleClearData}>
          Clear Data
        </button>
      </div>

      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
  },
  loading: {
    textAlign: "center",
    padding: "40px 20px",
    color: "hsl(0 0% 50%)",
    fontSize: "13px",
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    margin: "0 0 16px 0",
    color: "hsl(0 0% 20%)",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    marginBottom: "12px",
    cursor: "pointer",
  },
  field: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "4px",
    color: "hsl(0 0% 30%)",
  },
  input: {
    width: "100%",
    padding: "8px",
    fontSize: "12px",
    border: "1px solid hsl(0 0% 85%)",
    borderRadius: "4px",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
  },
  saveBtn: {
    flex: 1,
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 500,
    border: "none",
    borderRadius: "4px",
    background: "hsl(210 70% 50%)",
    color: "white",
    cursor: "pointer",
  },
  clearBtn: {
    padding: "8px 16px",
    fontSize: "12px",
    border: "1px solid hsl(0 70% 50%)",
    borderRadius: "4px",
    background: "white",
    color: "hsl(0 70% 50%)",
    cursor: "pointer",
  },
  message: {
    marginTop: "12px",
    fontSize: "12px",
    color: "hsl(120 50% 40%)",
    textAlign: "center",
  },
};
