import { useState, useRef, useEffect } from "preact/hooks";
import type { DataRetentionConfig } from "@pleno-audit/extension-runtime";
import { useTheme } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  onClearData: () => void;
  onExport?: () => void;
}

function formatRetentionDays(days: number): string {
  if (days < 30) return `${days}日`;
  const months = Math.round(days / 30);
  return months === 1 ? "1ヶ月" : `${months}ヶ月`;
}

export function SettingsMenu({ onClearData, onExport }: Props) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [retentionConfig, setRetentionConfig] = useState<DataRetentionConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && !retentionConfig) {
      chrome.runtime.sendMessage({ type: "GET_DATA_RETENTION_CONFIG" })
        .then((config) => {
          if (config) {
            setRetentionConfig(config);
          } else {
            setRetentionConfig({
              retentionDays: 180,
              autoCleanupEnabled: true,
              lastCleanupTimestamp: 0,
            });
          }
        })
        .catch(() => {
          setRetentionConfig({
            retentionDays: 180,
            autoCleanupEnabled: true,
            lastCleanupTimestamp: 0,
          });
        });
    }
  }, [isOpen, retentionConfig]);

  async function handleSaveRetention() {
    if (!retentionConfig) return;
    setSaving(true);
    try {
      await chrome.runtime.sendMessage({
        type: "SET_DATA_RETENTION_CONFIG",
        data: retentionConfig,
      });
    } catch (error) {
      console.error("Failed to save retention config:", error);
    }
    setSaving(false);
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textSecondary,
          fontSize: "16px",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.bgSecondary;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
        }}
        title="設定"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "160px",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
            <ThemeToggle />
          </div>

          <div style={{ padding: "12px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "8px", fontWeight: 500 }}>
              データ保持期間
            </div>
            {retentionConfig ? (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: colors.textPrimary, marginBottom: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={retentionConfig.autoCleanupEnabled}
                    onChange={(e) => setRetentionConfig({
                      ...retentionConfig,
                      autoCleanupEnabled: (e.target as HTMLInputElement).checked,
                    })}
                  />
                  自動クリーンアップ
                </label>
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "12px", color: colors.textPrimary, marginBottom: "4px" }}>
                    保持: {formatRetentionDays(retentionConfig.retentionDays)}
                  </div>
                  <input
                    type="range"
                    min="7"
                    max="365"
                    step="7"
                    value={retentionConfig.retentionDays}
                    onChange={(e) => setRetentionConfig({
                      ...retentionConfig,
                      retentionDays: parseInt((e.target as HTMLInputElement).value, 10),
                    })}
                    style={{ width: "100%" }}
                  />
                </div>
                <button
                  onClick={handleSaveRetention}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "6px 12px",
                    background: colors.interactive,
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </>
            ) : (
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>
            )}
          </div>

          {onExport && (
            <div style={{ padding: "4px", borderBottom: `1px solid ${colors.border}` }}>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onExport();
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: colors.textPrimary,
                  borderRadius: "4px",
                  textAlign: "left",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.bgSecondary;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                }}
              >
                <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                エクスポート
              </button>
            </div>
          )}

          <div style={{ padding: "4px" }}>
            <button
              onClick={() => {
                setIsOpen(false);
                onClearData();
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: colors.status.danger.text,
                borderRadius: "4px",
                textAlign: "left",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.bgSecondary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              <span style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
              データを削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
