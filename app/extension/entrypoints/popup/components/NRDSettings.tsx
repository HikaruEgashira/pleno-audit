import { useState, useEffect } from "preact/hooks";
import type { NRDConfig } from "@service-policy-auditor/detectors";
import { Button, Badge, Card } from "../../../components";
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

      setMessage("保存しました");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      console.error("Failed to save config:", error);
      setMessage("保存に失敗しました");
    }
    setSaving(false);
  }

  if (!nrdConfig) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>NRD検出設定</h3>
      <div style={styles.card}>
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
          <span>NRD検出を有効化</span>
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
              <span>RDAPルックアップを有効化</span>
            </label>

            <div style={{ marginBottom: "12px" }}>
              <label style={styles.label}>
                経過日数しきい値: <Badge>{nrdConfig.thresholdDays}日</Badge>
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
              <span style={{ fontSize: "11px", color: "#666" }}>
                この期間内に登録されたドメインをNRDとして検出
              </span>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={styles.label}>
                ヒューリスティック感度: <Badge>{nrdConfig.heuristicThreshold}</Badge>
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
              <span style={{ fontSize: "11px", color: "#666" }}>
                高い値=より厳格なマッチング (0-100)
              </span>
            </div>
          </>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          variant="primary"
        >
          {saving ? "保存中..." : "設定を保存"}
        </Button>

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
