import { useState, useEffect } from "preact/hooks";
import type { CSPConfig } from "@service-policy-controller/core";
import { styles } from "../styles";

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
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP Auditor Settings</h3>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) =>
            setConfig({
              ...config,
              enabled: (e.target as HTMLInputElement).checked,
            })
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

      <div style={{ marginBottom: "16px" }}>
        <label style={styles.label}>Report Endpoint (optional)</label>
        <input
          type="url"
          style={styles.input}
          value={endpoint}
          onChange={(e) => setEndpoint((e.target as HTMLInputElement).value)}
          placeholder="https://your-server.com/api/reports"
        />
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...styles.button,
            flex: 1,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <button
          onClick={handleClearData}
          style={{
            ...styles.buttonSecondary,
            color: "hsl(0 70% 50%)",
            borderColor: "hsl(0 70% 50%)",
          }}
        >
          Clear Data
        </button>
      </div>

      {message && (
        <p
          style={{
            marginTop: "12px",
            fontSize: "12px",
            color: "hsl(120 50% 40%)",
            textAlign: "center",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
