import { useState, useEffect } from "preact/hooks";
import type { CSPConfig } from "@service-policy-auditor/detectors";
import { Button, Badge } from "../../../components";
import { styles } from "../styles";

export function CSPSettings() {
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

      setMessage("保存しました");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Failed to save config:", error);
      setMessage("保存に失敗しました");
    }
    setSaving(false);
  }

  async function handleClearData() {
    if (!confirm("すべてのCSPデータを削除しますか？")) return;
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      setMessage("データを削除しました");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Failed to clear data:", error);
    }
  }

  if (!config) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP監査設定</h3>
      <div style={styles.card}>
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
          <span>CSP監査を有効化</span>
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
              <span>CSP違反を収集</span>
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
              <span>ネットワークリクエストを収集</span>
            </label>

            <div style={{ marginBottom: "16px" }}>
              <label style={styles.label}>レポートエンドポイント (オプション)</label>
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

        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="primary"
          >
            {saving ? "保存中..." : "設定を保存"}
          </Button>
          <Button
            onClick={handleClearData}
            variant="ghost"
          >
            データ削除
          </Button>
        </div>

        {message && (
          <p
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "#0a7227",
              textAlign: "center",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
