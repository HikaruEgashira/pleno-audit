import { useState, useEffect } from "preact/hooks";
import type { CSPConfig, NRDConfig } from "@pleno-audit/detectors";
import type { EnterpriseStatus } from "@pleno-audit/extension-runtime";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";
import { LockedBanner } from "./LockedBanner";

const DEFAULT_ENTERPRISE_STATUS: EnterpriseStatus = {
  isManaged: false,
  ssoRequired: false,
  settingsLocked: false,
  config: null,
};

export function Settings() {
  const styles = usePopupStyles();
  const { colors } = useTheme();
  const [config, setConfig] = useState<CSPConfig | null>(null);
  const [nrdConfig, setNRDConfig] = useState<NRDConfig | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [enterpriseStatus, setEnterpriseStatus] = useState<EnterpriseStatus>(DEFAULT_ENTERPRISE_STATUS);

  const isLocked = enterpriseStatus.settingsLocked;

  useEffect(() => {
    loadConfig();
    chrome.runtime.sendMessage({ type: "GET_ENTERPRISE_STATUS" })
      .then(setEnterpriseStatus)
      .catch(() => setEnterpriseStatus(DEFAULT_ENTERPRISE_STATUS));
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
      setRetentionDays(retCfg?.retentionDays ?? 180);
    } catch {
      // Failed to load config
    }
  }

  function handleRetentionChange(days: number) {
    if (isLocked) return;
    setRetentionDays(days);
    chrome.runtime.sendMessage({
      type: "SET_DATA_RETENTION_CONFIG",
      data: {
        retentionDays: days,
        autoCleanupEnabled: days !== 0,
        lastCleanupTimestamp: 0,
      },
    }).catch(() => {});
  }

  function formatRetentionDays(days: number): string {
    if (days === 0) return "No expiration";
    if (days < 30) return `${days} days`;
    const months = Math.round(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }

  async function handleSave() {
    if (!config || !nrdConfig || isLocked) return;
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
    } catch {
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
    } catch {
      // Failed to clear data
    }
  }

  if (!config || !nrdConfig || retentionDays === null) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      {isLocked && <LockedBanner />}

      <h3 style={styles.sectionTitle}>CSP Audit Settings</h3>

      <label style={{ ...styles.checkbox, opacity: isLocked ? 0.6 : 1 }}>
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={isLocked}
          onChange={(e) =>
            !isLocked && setConfig({
              ...config,
              enabled: (e.target as HTMLInputElement).checked,
            })
          }
        />
        <span style={{ color: colors.textPrimary }}>Enable CSP Auditing</span>
      </label>

      {config.enabled && (
        <>
          <label style={{ ...styles.checkbox, opacity: isLocked ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={config.collectCSPViolations}
              disabled={isLocked}
              onChange={(e) =>
                !isLocked && setConfig({
                  ...config,
                  collectCSPViolations: (e.target as HTMLInputElement).checked,
                })
              }
            />
            <span style={{ color: colors.textPrimary }}>Collect CSP Violations</span>
          </label>

          <label style={{ ...styles.checkbox, opacity: isLocked ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={config.collectNetworkRequests}
              disabled={isLocked}
              onChange={(e) =>
                !isLocked && setConfig({
                  ...config,
                  collectNetworkRequests: (e.target as HTMLInputElement).checked,
                })
              }
            />
            <span style={{ color: colors.textPrimary }}>Collect Network Requests</span>
          </label>

          <div style={{ marginBottom: "16px", opacity: isLocked ? 0.6 : 1 }}>
            <label style={styles.label}>Report Endpoint (optional)</label>
            <input
              type="url"
              style={styles.input}
              value={endpoint}
              disabled={isLocked}
              onChange={(e) => !isLocked && setEndpoint((e.target as HTMLInputElement).value)}
              placeholder="https://your-server.com/api/reports"
            />
          </div>
        </>
      )}

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${colors.border}` }} />

      <h3 style={styles.sectionTitle}>NRD Detection Settings</h3>

      <div style={{ marginBottom: "12px", opacity: isLocked ? 0.6 : 1 }}>
        <label style={styles.label}>
          Age Threshold (days): {nrdConfig.thresholdDays}
        </label>
        <input
          type="range"
          min="1"
          max="365"
          value={nrdConfig.thresholdDays}
          disabled={isLocked}
          onChange={(e) =>
            !isLocked && setNRDConfig({
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

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${colors.border}` }} />

      <h3 style={styles.sectionTitle}>Data Retention</h3>

      <div style={{ marginBottom: "12px", opacity: isLocked ? 0.6 : 1 }}>
        <label style={styles.label}>
          {formatRetentionDays(retentionDays)}
        </label>
        <input
          type="range"
          min="0"
          max="365"
          step="1"
          value={retentionDays}
          disabled={isLocked}
          onChange={(e) => handleRetentionChange(parseInt((e.target as HTMLInputElement).value, 10))}
          style={{ width: "100%", marginBottom: "4px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: colors.textSecondary }}>
          <span>No expiration</span>
          <span>1 year</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={saving || isLocked}
          style={{
            ...styles.button,
            flex: 1,
            cursor: saving || isLocked ? "not-allowed" : "pointer",
            opacity: saving || isLocked ? 0.6 : 1,
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
