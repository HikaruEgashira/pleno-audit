import { useState, useEffect } from "preact/hooks";
import type { CSPConfig, NRDConfig } from "@service-policy-auditor/detectors";
import { styles } from "../styles";

export function Settings() {
  const [config, setConfig] = useState<CSPConfig | null>(null);
  const [nrdConfig, setNRDConfig] = useState<NRDConfig | null>(null);
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

      const nrdCfg = await chrome.runtime.sendMessage({
        type: "GET_NRD_CONFIG",
      });
      setNRDConfig(nrdCfg);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function handleSave() {
    if (!config || !nrdConfig) return;
    setSaving(true);
    try {
      await chrome.runtime.sendMessage({
        type: "SET_CSP_CONFIG",
        data: {
          ...config,
          reportEndpoint: endpoint || null,
        },
      });

      await chrome.runtime.sendMessage({
        type: "SET_NRD_CONFIG",
        data: nrdConfig,
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

  if (!config || !nrdConfig) {
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

      {config.enabled && (
        <>
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
        </>
      )}

      <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid hsl(0 0% 80%)" }} />

      <h3 style={styles.sectionTitle}>NRD Detection Settings</h3>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={nrdConfig.enabled}
          onChange={(e) =>
            setNRDConfig({
              ...nrdConfig,
              enabled: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <span>Enable NRD Detection</span>
      </label>

      {nrdConfig.enabled && (
        <>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={nrdConfig.enableRDAP}
              onChange={(e) =>
                setNRDConfig({
                  ...nrdConfig,
                  enableRDAP: (e.target as HTMLInputElement).checked,
                })
              }
            />
            <span>Enable RDAP Lookup (API queries)</span>
          </label>

          <div style={{ marginBottom: "12px" }}>
            <label style={styles.label}>
              Age Threshold (days): {nrdConfig.thresholdDays}
            </label>
            <input
              type="range"
              min="1"
              max="365"
              value={nrdConfig.thresholdDays}
              onChange={(e) =>
                setNRDConfig({
                  ...nrdConfig,
                  thresholdDays: parseInt((e.target as HTMLInputElement).value, 10),
                })
              }
              style={{ width: "100%", marginBottom: "4px" }}
            />
            <span style={{ fontSize: "11px", color: "hsl(0 0% 60%)" }}>
              Domains registered within this period are flagged as NRD
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={styles.label}>
              Heuristic Sensitivity: {nrdConfig.heuristicThreshold}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={nrdConfig.heuristicThreshold}
              onChange={(e) =>
                setNRDConfig({
                  ...nrdConfig,
                  heuristicThreshold: parseInt((e.target as HTMLInputElement).value, 10),
                })
              }
              style={{ width: "100%", marginBottom: "4px" }}
            />
            <span style={{ fontSize: "11px", color: "hsl(0 0% 60%)" }}>
              Higher = stricter heuristic matching (0-100)
            </span>
          </div>
        </>
      )}

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
