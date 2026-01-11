import { useState, useEffect } from "preact/hooks";
import type { CSPConfig, NRDConfig } from "@pleno-audit/detectors";
import type { DataRetentionConfig } from "@pleno-audit/extension-runtime";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

export function Settings() {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [config, setConfig] = useState<CSPConfig | null>(null);
  const [nrdConfig, setNRDConfig] = useState<NRDConfig | null>(null);
  const [retentionConfig, setRetentionConfig] = useState<DataRetentionConfig | null>(null);
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

      const retCfg = await chrome.runtime.sendMessage({
        type: "GET_DATA_RETENTION_CONFIG",
      });
      setRetentionConfig(retCfg);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function handleSave() {
    if (!config || !nrdConfig || !retentionConfig) return;
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

      await chrome.runtime.sendMessage({
        type: "SET_DATA_RETENTION_CONFIG",
        data: retentionConfig,
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

  if (!config || !nrdConfig || !retentionConfig) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>Loading...</p>
      </div>
    );
  }

  function formatRetentionDays(days: number): string {
    if (days < 30) return `${days} days`;
    const months = Math.round(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP Audit Settings</h3>

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
        <span style={{ color: colors.textPrimary }}>Enable CSP Auditing</span>
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
            <span style={{ color: colors.textPrimary }}>Collect CSP Violations</span>
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
            <span style={{ color: colors.textPrimary }}>Collect Network Requests</span>
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

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${colors.border}` }} />

      <h3 style={styles.sectionTitle}>Suspicious Domain Detection Settings</h3>

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
        <span style={{ color: colors.textPrimary }}>Enable RDAP Lookup (API queries)</span>
      </label>

      {nrdConfig.enableRDAP && (
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
          <span style={{ fontSize: "11px", color: colors.textSecondary }}>
            Domains registered within this period are flagged as NRD
          </span>
        </div>
      )}

      <div style={{ marginBottom: "12px" }}>
        <label style={styles.label}>
          Suspicious Threshold: {nrdConfig.suspiciousThreshold}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={nrdConfig.suspiciousThreshold}
          onChange={(e) =>
            setNRDConfig({
              ...nrdConfig,
              suspiciousThreshold: parseInt((e.target as HTMLInputElement).value, 10),
            })
          }
          style={{ width: "100%", marginBottom: "4px" }}
        />
        <span style={{ fontSize: "11px", color: colors.textSecondary }}>
          Higher = stricter matching (0-100)
        </span>
      </div>

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${colors.border}` }} />

      <h3 style={styles.sectionTitle}>Data Retention Settings</h3>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={retentionConfig.autoCleanupEnabled}
          onChange={(e) =>
            setRetentionConfig({
              ...retentionConfig,
              autoCleanupEnabled: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <span style={{ color: colors.textPrimary }}>Auto cleanup old data</span>
      </label>

      <div style={{ marginBottom: "12px" }}>
        <label style={styles.label}>
          Retention Period: {formatRetentionDays(retentionConfig.retentionDays)}
        </label>
        <input
          type="range"
          min="7"
          max="365"
          step="7"
          value={retentionConfig.retentionDays}
          onChange={(e) =>
            setRetentionConfig({
              ...retentionConfig,
              retentionDays: parseInt((e.target as HTMLInputElement).value, 10),
            })
          }
          style={{ width: "100%", marginBottom: "4px" }}
        />
        <span style={{ fontSize: "11px", color: colors.textSecondary }}>
          Data older than this will be automatically deleted (default: 6 months)
        </span>
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
            color: colors.status.danger.text,
            borderColor: colors.status.danger.border,
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
            color: colors.status.success.text,
            textAlign: "center",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
