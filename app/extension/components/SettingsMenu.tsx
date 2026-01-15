import { useState, useRef, useEffect } from "preact/hooks";
import { useTheme } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";
import {
  DEFAULT_BLOCKING_CONFIG,
  type BlockingConfig,
} from "@pleno-audit/extension-runtime";

interface Props {
  onClearData: () => void;
  onExport?: () => void;
}

interface ServerConnectionConfig {
  enabled: boolean;
  endpoint: string;
  userConsentGiven: boolean;
}

const DEFAULT_SERVER_CONFIG: ServerConnectionConfig = {
  enabled: false,
  endpoint: "",
  userConsentGiven: false,
};

function formatRetentionDays(days: number): string {
  if (days === 0) return "無期限";
  if (days < 30) return `${days}日`;
  const months = Math.round(days / 30);
  return months === 1 ? "1ヶ月" : `${months}ヶ月`;
}

export function SettingsMenu({ onClearData, onExport }: Props) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [blockingConfig, setBlockingConfig] = useState<BlockingConfig | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConnectionConfig | null>(null);
  const [showServerConsentDialog, setShowServerConsentDialog] = useState(false);
  const [serverEndpointInput, setServerEndpointInput] = useState("");
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
    if (isOpen && retentionDays === null) {
      chrome.runtime.sendMessage({ type: "GET_DATA_RETENTION_CONFIG" })
        .then((config) => {
          setRetentionDays(config?.retentionDays ?? 180);
        })
        .catch(() => {
          setRetentionDays(180);
        });
    }
  }, [isOpen, retentionDays]);

  useEffect(() => {
    if (isOpen && blockingConfig === null) {
      chrome.runtime.sendMessage({ type: "GET_BLOCKING_CONFIG" })
        .then((config) => {
          setBlockingConfig(config ?? DEFAULT_BLOCKING_CONFIG);
        })
        .catch(() => {
          setBlockingConfig(DEFAULT_BLOCKING_CONFIG);
        });
    }
  }, [isOpen, blockingConfig]);

  useEffect(() => {
    if (isOpen && serverConfig === null) {
      chrome.storage.local.get(["serverConnectionConfig"])
        .then((result) => {
          const config = result.serverConnectionConfig ?? DEFAULT_SERVER_CONFIG;
          setServerConfig(config);
          setServerEndpointInput(config.endpoint || "");
        })
        .catch(() => {
          setServerConfig(DEFAULT_SERVER_CONFIG);
        });
    }
  }, [isOpen, serverConfig]);

  // Escキーでダイアログを閉じる
  useEffect(() => {
    if (!showConsentDialog && !showServerConsentDialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowConsentDialog(false);
        setShowServerConsentDialog(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showConsentDialog, showServerConsentDialog]);

  function handleRetentionChange(days: number) {
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

  function handleBlockingToggle() {
    if (!blockingConfig) return;

    if (!blockingConfig.userConsentGiven && !blockingConfig.enabled) {
      setShowConsentDialog(true);
      return;
    }

    const newConfig = { ...blockingConfig, enabled: !blockingConfig.enabled };
    setBlockingConfig(newConfig);
    chrome.runtime.sendMessage({
      type: "SET_BLOCKING_CONFIG",
      data: newConfig,
    }).catch(() => {});
  }

  function handleConsentAccept() {
    if (!blockingConfig) return;

    const newConfig = {
      ...blockingConfig,
      enabled: true,
      userConsentGiven: true,
    };
    setBlockingConfig(newConfig);
    setShowConsentDialog(false);
    chrome.runtime.sendMessage({
      type: "SET_BLOCKING_CONFIG",
      data: newConfig,
    }).catch(() => {});
  }

  function handleServerToggle() {
    if (!serverConfig) return;

    if (!serverConfig.userConsentGiven && !serverConfig.enabled) {
      setShowServerConsentDialog(true);
      return;
    }

    const newConfig = { ...serverConfig, enabled: !serverConfig.enabled };
    setServerConfig(newConfig);
    chrome.storage.local.set({ serverConnectionConfig: newConfig }).catch(() => {});

    // Update API client mode
    chrome.runtime.sendMessage({
      type: "SET_CONNECTION_CONFIG",
      data: {
        mode: newConfig.enabled ? "remote" : "local",
        endpoint: newConfig.endpoint,
      },
    }).catch(() => {});
  }

  function handleServerConsentAccept() {
    if (!serverConfig) return;

    // Validate endpoint
    if (!serverEndpointInput.trim()) {
      return;
    }

    try {
      new URL(serverEndpointInput);
    } catch {
      return;
    }

    const newConfig: ServerConnectionConfig = {
      enabled: true,
      endpoint: serverEndpointInput,
      userConsentGiven: true,
    };
    setServerConfig(newConfig);
    setShowServerConsentDialog(false);
    chrome.storage.local.set({ serverConnectionConfig: newConfig }).catch(() => {});

    // Update API client mode
    chrome.runtime.sendMessage({
      type: "SET_CONNECTION_CONFIG",
      data: {
        mode: "remote",
        endpoint: serverEndpointInput,
      },
    }).catch(() => {});
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
            {retentionDays !== null ? (
              <div>
                <div style={{ fontSize: "12px", color: colors.textPrimary, marginBottom: "4px" }}>
                  {formatRetentionDays(retentionDays)}
                </div>
                <input
                  type="range"
                  min="0"
                  max="365"
                  step="1"
                  value={retentionDays}
                  onChange={(e) => handleRetentionChange(parseInt((e.target as HTMLInputElement).value, 10))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: colors.textMuted, marginTop: "2px" }}>
                  <span>無期限</span>
                  <span>1年</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>
            )}
          </div>

          <div style={{ padding: "12px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "8px", fontWeight: 500 }}>
              保護機能
            </div>
            {blockingConfig !== null ? (
              <div>
                <button
                  onClick={handleBlockingToggle}
                  aria-pressed={blockingConfig.enabled}
                  aria-label={`リスクブロック: ${blockingConfig.enabled ? "有効" : "無効"}`}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: blockingConfig.enabled ? colors.status.success.bg : colors.bgSecondary,
                    border: `1px solid ${blockingConfig.enabled ? colors.status.success.text : colors.border}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: blockingConfig.enabled ? colors.status.success.text : colors.textPrimary,
                    transition: "all 0.15s",
                  }}
                >
                  <span>リスクブロック</span>
                  <span style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: blockingConfig.enabled ? colors.status.success.text : colors.textMuted,
                    color: colors.bgPrimary,
                  }}>
                    {blockingConfig.enabled ? "ON" : "OFF"}
                  </span>
                </button>
                <div style={{ fontSize: "10px", color: colors.textMuted, marginTop: "6px", lineHeight: 1.4 }}>
                  タイポスクワット、NRDログイン、機密データ送信を検出時にブロック
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>
            )}
          </div>

          <div style={{ padding: "12px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "11px", color: colors.textSecondary, marginBottom: "8px", fontWeight: 500 }}>
              サーバー連携
            </div>
            {serverConfig !== null ? (
              <div>
                <button
                  onClick={handleServerToggle}
                  aria-pressed={serverConfig.enabled}
                  aria-label={`サーバー連携: ${serverConfig.enabled ? "有効" : "無効"}`}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: serverConfig.enabled ? colors.status.info.bg : colors.bgSecondary,
                    border: `1px solid ${serverConfig.enabled ? colors.status.info.text : colors.border}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: serverConfig.enabled ? colors.status.info.text : colors.textPrimary,
                    transition: "all 0.15s",
                  }}
                >
                  <span>組織管理</span>
                  <span style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: serverConfig.enabled ? colors.status.info.text : colors.textMuted,
                    color: colors.bgPrimary,
                  }}>
                    {serverConfig.enabled ? "ON" : "OFF"}
                  </span>
                </button>
                <div style={{ fontSize: "10px", color: colors.textMuted, marginTop: "6px", lineHeight: 1.4 }}>
                  組織サーバーとの連携（オプトイン）
                </div>
                {serverConfig.enabled && serverConfig.endpoint && (
                  <div style={{ fontSize: "10px", color: colors.status.info.text, marginTop: "4px", wordBreak: "break-all" }}>
                    接続先: {serverConfig.endpoint}
                  </div>
                )}
              </div>
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

      {showConsentDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-dialog-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowConsentDialog(false)}
        >
          <div
            role="document"
            style={{
              backgroundColor: colors.bgPrimary,
              borderRadius: "12px",
              padding: "20px",
              maxWidth: "320px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="consent-dialog-title" style={{ fontSize: "14px", fontWeight: 600, color: colors.textPrimary, marginBottom: "12px" }}>
              保護機能を有効化
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, lineHeight: 1.6, marginBottom: "16px" }}>
              この機能を有効にすると、以下のリスクを検出時にブロックまたは警告します：
            </div>
            <ul style={{ fontSize: "11px", color: colors.textSecondary, margin: "0 0 16px 16px", padding: 0, lineHeight: 1.8 }}>
              <li>タイポスクワットドメインへのアクセス</li>
              <li>新規登録ドメイン(NRD)でのログイン</li>
              <li>AIサービスへの機密データ送信</li>
            </ul>
            <div style={{ fontSize: "10px", color: colors.textMuted, marginBottom: "16px", lineHeight: 1.5 }}>
              ※ すべての処理は端末内で完結し、外部へのデータ送信は行いません。
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowConsentDialog(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: colors.textSecondary,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConsentAccept}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: colors.status.success.bg,
                  border: `1px solid ${colors.status.success.text}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: colors.status.success.text,
                  fontWeight: 500,
                }}
              >
                有効化する
              </button>
            </div>
          </div>
        </div>
      )}

      {showServerConsentDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="server-consent-dialog-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowServerConsentDialog(false)}
        >
          <div
            role="document"
            style={{
              backgroundColor: colors.bgPrimary,
              borderRadius: "12px",
              padding: "20px",
              maxWidth: "360px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="server-consent-dialog-title" style={{ fontSize: "14px", fontWeight: 600, color: colors.textPrimary, marginBottom: "12px" }}>
              サーバー連携を有効化
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary, lineHeight: 1.6, marginBottom: "16px" }}>
              この機能を有効にすると、組織のサーバーと連携してセキュリティデータを一元管理できます。
            </div>
            <div style={{
              fontSize: "11px",
              color: colors.status.warning.text,
              background: colors.status.warning.bg,
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "16px",
              lineHeight: 1.6,
            }}>
              この機能を有効にすると、以下のデータが指定したサーバーに送信されます：
              <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                <li>匿名化されたセキュリティイベント</li>
                <li>ポリシー設定</li>
                <li>集計された統計データ</li>
              </ul>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", color: colors.textSecondary, display: "block", marginBottom: "6px" }}>
                サーバーエンドポイント
              </label>
              <input
                type="url"
                value={serverEndpointInput}
                onChange={(e) => setServerEndpointInput((e.target as HTMLInputElement).value)}
                placeholder="https://your-server.example.com/api"
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "12px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "6px",
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ fontSize: "10px", color: colors.textMuted, marginBottom: "16px", lineHeight: 1.5 }}>
              ※ 閲覧履歴、パスワード、AIプロンプトの内容は送信されません。
              詳細は<a href="https://github.com/HikaruEgashira/pleno-audit/blob/main/docs/PRIVACY.md" target="_blank" rel="noopener noreferrer" style={{ color: colors.status.info.text }}>プライバシーポリシー</a>をご確認ください。
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowServerConsentDialog(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: colors.textSecondary,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleServerConsentAccept}
                disabled={!serverEndpointInput.trim()}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: serverEndpointInput.trim() ? colors.status.info.bg : colors.bgSecondary,
                  border: `1px solid ${serverEndpointInput.trim() ? colors.status.info.text : colors.border}`,
                  borderRadius: "6px",
                  cursor: serverEndpointInput.trim() ? "pointer" : "not-allowed",
                  fontSize: "12px",
                  color: serverEndpointInput.trim() ? colors.status.info.text : colors.textMuted,
                  fontWeight: 500,
                  opacity: serverEndpointInput.trim() ? 1 : 0.6,
                }}
              >
                有効化する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
