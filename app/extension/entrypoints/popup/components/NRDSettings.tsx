import { useState, useEffect } from "preact/hooks";
import type { NRDConfig } from "@service-policy-auditor/detectors";
import { styles } from "../styles";

export function NRDSettings() {
  const [nrdConfig, setNRDConfig] = useState<NRDConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const nrdCfg = await chrome.runtime.sendMessage({
        type: "GET_NRD_CONFIG",
      });
      setNRDConfig(nrdCfg);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function handleSave() {
    if (!nrdConfig) return;
    setSaving(true);
    try {
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

  if (!nrdConfig) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
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

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          ...styles.button,
          width: "100%",
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

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
