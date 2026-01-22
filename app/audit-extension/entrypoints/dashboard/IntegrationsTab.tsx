import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import {
  createIntegrationManager,
  INTEGRATION_TEMPLATES,
  WORKFLOW_TEMPLATES,
  type Integration,
  type Workflow,
  type IntegrationType,
  type IntegrationConfig,
  type SlackConfig,
  type WebhookConfig,
} from "@pleno-audit/integrations";
import {
  type OIDCConfig,
  type SAMLConfig,
  type SSOSession,
  getSSOManager,
} from "@pleno-audit/extension-runtime";
import {
  Plug,
  Play,
  Trash2,
  Zap,
  Mail,
  MessageSquare,
  Globe,
  GitBranch,
  Settings,
  X,
  Server,
  Shield,
  Key,
  CheckCircle,
  AlertCircle,
} from "lucide-preact";
import { useTheme, spacing, type ThemeColors } from "../../lib/theme";
import { Badge, Button, Card, StatCard, EmptyState, StatsGrid } from "../../components";

// SIEM Connection Config type
export interface SIEMConnectionConfig {
  enabled: boolean;
  endpoint: string;
  authMethod: "none" | "apikey" | "oidc" | "saml";
  apiKey?: string;
  oidcConfig?: OIDCConfig;
  samlConfig?: SAMLConfig;
  userConsentGiven: boolean;
}

const DEFAULT_SIEM_CONFIG: SIEMConnectionConfig = {
  enabled: false,
  endpoint: "",
  authMethod: "none",
  userConsentGiven: false,
};

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "active": return colors.dot.success;
    case "inactive": return colors.dot.default;
    case "error": return colors.dot.danger;
    case "pending": return colors.dot.warning;
    default: return colors.dot.default;
  }
}

function getIntegrationIcon(type: string) {
  switch (type) {
    case "slack": return <MessageSquare size={20} />;
    case "email": return <Mail size={20} />;
    case "webhook": return <Globe size={20} />;
    case "github": return <GitBranch size={20} />;
    default: return <Plug size={20} />;
  }
}

interface EditDialogProps {
  integration: Integration;
  onSave: (id: string, config: IntegrationConfig) => void;
  onClose: () => void;
}

function EditDialog({ integration, onSave, onClose }: EditDialogProps) {
  const { colors } = useTheme();
  const [url, setUrl] = useState(() => {
    const config = integration.config;
    if (config.type === "webhook") return (config as WebhookConfig).url;
    if (config.type === "slack") return (config as SlackConfig).webhookUrl;
    return "";
  });

  const handleSave = () => {
    let newConfig: IntegrationConfig;
    if (integration.config.type === "slack") {
      newConfig = { ...integration.config, webhookUrl: url } as SlackConfig;
    } else {
      newConfig = { ...integration.config, url } as WebhookConfig;
    }
    onSave(integration.id, newConfig);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.bgPrimary,
          borderRadius: "12px",
          padding: "24px",
          width: "480px",
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>{integration.name} 設定</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "4px" }}>
            {integration.config.type === "slack" ? "Slack Webhook URL" : "Webhook URL"}
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
            placeholder={integration.config.type === "slack" ? "https://hooks.slack.com/services/..." : "https://example.com/webhook"}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${colors.border}`,
              background: colors.bgSecondary,
              color: colors.textPrimary,
              fontSize: "13px",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={handleSave}>保存</Button>
        </div>
      </div>
    </div>
  );
}

interface IntegrationCardProps {
  integration: Integration;
  onToggle: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (integration: Integration) => void;
}

function IntegrationCard({ integration, onToggle, onTest, onDelete, onEdit }: IntegrationCardProps) {
  const { colors } = useTheme();
  const statusColor = getStatusColor(integration.status, colors);

  const configUrl = integration.config.type === "slack"
    ? (integration.config as SlackConfig).webhookUrl
    : (integration.config as WebhookConfig).url;

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${colors.border}`,
        padding: "16px",
        opacity: integration.status === "inactive" ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: colors.bgSecondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textSecondary,
          }}
        >
          {getIntegrationIcon(integration.type)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{integration.name}</span>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: statusColor,
              }}
            />
            <span style={{ fontSize: "11px", color: colors.textMuted }}>
              {integration.status}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "4px" }}>
            {integration.type} • {integration.triggers.filter(t => t.enabled).length} triggers
          </div>
          <div
            style={{
              fontSize: "11px",
              color: colors.textMuted,
              marginBottom: "8px",
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "300px",
            }}
            title={configUrl}
          >
            {configUrl}
          </div>
          {integration.errorMessage && (
            <div style={{ fontSize: "11px", color: colors.dot.danger, marginBottom: "8px" }}>
              Error: {integration.errorMessage}
            </div>
          )}
          {integration.lastTriggered && (
            <div style={{ fontSize: "11px", color: colors.textMuted }}>
              Last triggered: {new Date(integration.lastTriggered).toLocaleString("ja-JP")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onEdit(integration)}
            title="設定"
          >
            <Settings size={14} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onTest(integration.id)}
            title="テスト"
          >
            <Play size={14} />
          </Button>
          <Button
            size="sm"
            variant={integration.status === "active" ? "primary" : "secondary"}
            onClick={() => onToggle(integration.id)}
          >
            {integration.status === "active" ? "有効" : "無効"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onDelete(integration.id)}
            title="削除"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
  onToggle: (id: string) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

function WorkflowCard({ workflow, onToggle, onRun, onDelete }: WorkflowCardProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${colors.border}`,
        padding: "16px",
        opacity: workflow.enabled ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: workflow.enabled ? `${colors.dot.info}20` : colors.bgSecondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: workflow.enabled ? colors.dot.info : colors.textMuted,
          }}
        >
          <Zap size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{workflow.name}</span>
            <Badge variant={workflow.enabled ? "success" : "default"} size="sm">
              {workflow.enabled ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {workflow.description}
          </div>
          <div style={{ fontSize: "11px", color: colors.textMuted }}>
            Trigger: {workflow.trigger.type}
            {workflow.trigger.event && ` (${workflow.trigger.event})`}
            {workflow.trigger.schedule && ` (${workflow.trigger.schedule})`}
            • {workflow.actions.length} actions • {workflow.runCount} runs
          </div>
          {workflow.lastRun && (
            <div style={{ fontSize: "11px", color: colors.textMuted, marginTop: "4px" }}>
              Last run: {new Date(workflow.lastRun).toLocaleString("ja-JP")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRun(workflow.id)}
            title="実行"
            disabled={!workflow.enabled}
          >
            <Play size={14} />
          </Button>
          <Button
            size="sm"
            variant={workflow.enabled ? "primary" : "secondary"}
            onClick={() => onToggle(workflow.id)}
          >
            {workflow.enabled ? "有効" : "無効"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onDelete(workflow.id)}
            title="削除"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// SIEM View Component
interface SIEMViewProps {
  colors: ThemeColors;
}

function SIEMView({ colors }: SIEMViewProps) {
  const [siemConfig, setSiemConfig] = useState<SIEMConnectionConfig | null>(null);
  const [endpointInput, setEndpointInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [authMethod, setAuthMethod] = useState<SIEMConnectionConfig["authMethod"]>("none");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcAuthority, setOidcAuthority] = useState("");
  const [oidcScope, setOidcScope] = useState("openid profile email");
  const [samlEntityId, setSamlEntityId] = useState("");
  const [samlEntryPoint, setSamlEntryPoint] = useState("");
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [ssoSession, setSsoSession] = useState<SSOSession | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Load SIEM config on mount
  useEffect(() => {
    chrome.storage.local.get(["siemConnectionConfig"])
      .then((result) => {
        const config = result.siemConnectionConfig ?? DEFAULT_SIEM_CONFIG;
        setSiemConfig(config);
        setEndpointInput(config.endpoint || "");
        setAuthMethod(config.authMethod || "none");
        setApiKeyInput(config.apiKey || "");
        if (config.oidcConfig) {
          setOidcClientId(config.oidcConfig.clientId || "");
          setOidcAuthority(config.oidcConfig.authority || "");
          setOidcScope(config.oidcConfig.scope || "openid profile email");
        }
        if (config.samlConfig) {
          setSamlEntityId(config.samlConfig.entityId || "");
          setSamlEntryPoint(config.samlConfig.entryPoint || "");
        }
      })
      .catch(() => setSiemConfig(DEFAULT_SIEM_CONFIG));

    // Load SSO session status
    getSSOManager().then(async (manager) => {
      const session = await manager.getSession();
      setSsoSession(session);
    }).catch(() => {});
  }, []);

  const handleSaveConfig = async () => {
    if (!siemConfig?.userConsentGiven) {
      setShowConsentDialog(true);
      return;
    }

    const newConfig: SIEMConnectionConfig = {
      enabled: true,
      endpoint: endpointInput,
      authMethod,
      apiKey: authMethod === "apikey" ? apiKeyInput : undefined,
      oidcConfig: authMethod === "oidc" ? {
        provider: "oidc",
        clientId: oidcClientId,
        authority: oidcAuthority,
        scope: oidcScope,
      } : undefined,
      samlConfig: authMethod === "saml" ? {
        provider: "saml",
        entityId: samlEntityId,
        entryPoint: samlEntryPoint,
      } : undefined,
      userConsentGiven: true,
    };

    await chrome.storage.local.set({ siemConnectionConfig: newConfig });
    setSiemConfig(newConfig);

    // Update SSO manager config if using OIDC/SAML
    if (authMethod === "oidc" && newConfig.oidcConfig) {
      const manager = await getSSOManager();
      await manager.setConfig(newConfig.oidcConfig);
    } else if (authMethod === "saml" && newConfig.samlConfig) {
      const manager = await getSSOManager();
      await manager.setConfig(newConfig.samlConfig);
    }

    // Update API client mode
    chrome.runtime.sendMessage({
      type: "SET_CONNECTION_CONFIG",
      data: {
        mode: "remote",
        endpoint: endpointInput,
      },
    }).catch(() => {});
  };

  const handleConsentAccept = async () => {
    const newConfig: SIEMConnectionConfig = {
      ...siemConfig!,
      userConsentGiven: true,
    };
    setSiemConfig(newConfig);
    setShowConsentDialog(false);
    await handleSaveConfig();
  };

  const handleDisable = async () => {
    const newConfig = DEFAULT_SIEM_CONFIG;
    await chrome.storage.local.set({ siemConnectionConfig: newConfig });
    setSiemConfig(newConfig);
    setEndpointInput("");
    setAuthMethod("none");
    setApiKeyInput("");
    setOidcClientId("");
    setOidcAuthority("");
    setSamlEntityId("");
    setSamlEntryPoint("");

    chrome.runtime.sendMessage({
      type: "SET_CONNECTION_CONFIG",
      data: { mode: "local", endpoint: null },
    }).catch(() => {});
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    try {
      const response = await fetch(`${endpointInput}/health`, {
        method: "GET",
        headers: authMethod === "apikey" && apiKeyInput
          ? { "Authorization": `Bearer ${apiKeyInput}` }
          : {},
      });
      setConnectionStatus(response.ok ? "success" : "error");
    } catch {
      setConnectionStatus("error");
    }
    setTimeout(() => setConnectionStatus("idle"), 3000);
  };

  const handleStartAuth = async () => {
    setIsAuthenticating(true);
    try {
      chrome.runtime.sendMessage({
        type: "START_SSO_AUTH",
        data: { provider: authMethod },
      }).then((result) => {
        if (result?.success) {
          setSsoSession(result.session);
        }
        setIsAuthenticating(false);
      }).catch(() => setIsAuthenticating(false));
    } catch {
      setIsAuthenticating(false);
    }
  };

  if (siemConfig === null) {
    return <div style={{ fontSize: "12px", color: colors.textSecondary }}>読み込み中...</div>;
  }

  return (
    <>
      {/* SIEM Connection Card */}
      <Card title="SIEM接続設定" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Endpoint URL */}
          <div>
            <label style={{ display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "6px" }}>
              SIEMエンドポイントURL
            </label>
            <input
              type="url"
              value={endpointInput}
              onChange={(e) => setEndpointInput((e.target as HTMLInputElement).value)}
              placeholder="https://siem.example.com/api"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                background: colors.bgSecondary,
                color: colors.textPrimary,
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Auth Method Selection */}
          <div>
            <label style={{ display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "6px" }}>
              認証方法
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(["none", "apikey", "oidc", "saml"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setAuthMethod(method)}
                  style={{
                    padding: "8px 16px",
                    background: authMethod === method ? colors.status.info.bg : colors.bgSecondary,
                    border: `1px solid ${authMethod === method ? colors.status.info.text : colors.border}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: authMethod === method ? colors.status.info.text : colors.textPrimary,
                    fontWeight: authMethod === method ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {method === "none" ? "認証なし" : method === "apikey" ? "API Key" : method.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Auth Method Specific Config */}
          {authMethod === "apikey" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: colors.textSecondary, marginBottom: "6px" }}>
                API Key
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput((e.target as HTMLInputElement).value)}
                placeholder="sk-..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.border}`,
                  background: colors.bgSecondary,
                  color: colors.textPrimary,
                  fontSize: "13px",
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {authMethod === "oidc" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px", background: colors.bgSecondary, borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Key size={16} color={colors.status.info.text} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: colors.textPrimary }}>OpenID Connect設定</span>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                  Client ID
                </label>
                <input
                  type="text"
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId((e.target as HTMLInputElement).value)}
                  placeholder="your-client-id"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                  Authority (IdP URL)
                </label>
                <input
                  type="url"
                  value={oidcAuthority}
                  onChange={(e) => setOidcAuthority((e.target as HTMLInputElement).value)}
                  placeholder="https://login.example.com"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                  Scope
                </label>
                <input
                  type="text"
                  value={oidcScope}
                  onChange={(e) => setOidcScope((e.target as HTMLInputElement).value)}
                  placeholder="openid profile email"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {authMethod === "saml" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px", background: colors.bgSecondary, borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Shield size={16} color={colors.status.info.text} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: colors.textPrimary }}>SAML 2.0設定</span>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                  Entity ID (SP)
                </label>
                <input
                  type="text"
                  value={samlEntityId}
                  onChange={(e) => setSamlEntityId((e.target as HTMLInputElement).value)}
                  placeholder="https://pleno-audit.example.com"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                  IdP Entry Point (SSO URL)
                </label>
                <input
                  type="url"
                  value={samlEntryPoint}
                  onChange={(e) => setSamlEntryPoint((e.target as HTMLInputElement).value)}
                  placeholder="https://idp.example.com/sso/saml"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: `1px solid ${colors.border}`,
                    background: colors.bgPrimary,
                    color: colors.textPrimary,
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {/* SSO Session Status */}
          {(authMethod === "oidc" || authMethod === "saml") && ssoSession && (
            <div style={{
              padding: "12px",
              background: colors.status.success.bg,
              border: `1px solid ${colors.status.success.text}`,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}>
              <CheckCircle size={20} color={colors.status.success.text} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: colors.status.success.text }}>
                  認証済み
                </div>
                {ssoSession.userEmail && (
                  <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                    {ssoSession.userEmail}
                  </div>
                )}
                {ssoSession.expiresAt && (
                  <div style={{ fontSize: "11px", color: colors.textMuted }}>
                    有効期限: {new Date(ssoSession.expiresAt).toLocaleString("ja-JP")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(authMethod === "oidc" || authMethod === "saml") && !ssoSession && (
              <Button
                variant="primary"
                onClick={handleStartAuth}
                disabled={isAuthenticating || !endpointInput || (authMethod === "oidc" && (!oidcClientId || !oidcAuthority)) || (authMethod === "saml" && !samlEntityId)}
              >
                {isAuthenticating ? "認証中..." : "認証を開始"}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              disabled={!endpointInput || connectionStatus === "testing"}
            >
              {connectionStatus === "testing" ? "テスト中..." : connectionStatus === "success" ? (
                <><CheckCircle size={14} style={{ marginRight: "4px" }} /> 接続成功</>
              ) : connectionStatus === "error" ? (
                <><AlertCircle size={14} style={{ marginRight: "4px" }} /> 接続失敗</>
              ) : "接続テスト"}
            </Button>
            <Button variant="primary" onClick={handleSaveConfig} disabled={!endpointInput}>
              保存
            </Button>
            {siemConfig.enabled && (
              <Button variant="secondary" onClick={handleDisable}>
                無効化
              </Button>
            )}
          </div>

          {/* Current Status */}
          {siemConfig.enabled && (
            <div style={{
              padding: "12px",
              background: colors.status.info.bg,
              border: `1px solid ${colors.status.info.text}`,
              borderRadius: "8px",
            }}>
              <div style={{ fontSize: "12px", color: colors.status.info.text, fontWeight: 600, marginBottom: "4px" }}>
                SIEM連携が有効です
              </div>
              <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                接続先: {siemConfig.endpoint}
              </div>
              <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                認証方法: {siemConfig.authMethod === "none" ? "認証なし" : siemConfig.authMethod === "apikey" ? "API Key" : siemConfig.authMethod.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Data Privacy Notice */}
      <Card title="プライバシーについて">
        <div style={{ fontSize: "12px", color: colors.textSecondary, lineHeight: 1.8 }}>
          <p style={{ margin: "0 0 12px 0" }}>
            SIEM連携を有効にすると、以下のデータが指定したサーバーに送信されます：
          </p>
          <ul style={{ margin: "0 0 12px 16px", padding: 0 }}>
            <li>匿名化されたセキュリティイベント</li>
            <li>ポリシー設定</li>
            <li>集計された統計データ</li>
          </ul>
          <p style={{ margin: 0, fontSize: "11px", color: colors.textMuted }}>
            ※ 閲覧履歴、パスワード、AIプロンプトの内容は送信されません。
          </p>
        </div>
      </Card>

      {/* Consent Dialog */}
      {showConsentDialog && (
        <div
          role="dialog"
          aria-modal="true"
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
              maxWidth: "380px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: colors.textPrimary, marginBottom: "12px" }}>
              SIEM連携を有効化
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
              この機能を有効にすると、セキュリティデータが指定したSIEMサーバーに送信されます。
            </div>
            <div style={{ fontSize: "11px", color: colors.textMuted, marginBottom: "16px", lineHeight: 1.5 }}>
              ※ 詳細は<a href="https://github.com/HikaruEgashira/pleno-audit/blob/main/docs/PRIVACY.md" target="_blank" rel="noopener noreferrer" style={{ color: colors.status.info.text }}>プライバシーポリシー</a>をご確認ください。
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="secondary" onClick={() => setShowConsentDialog(false)} style={{ flex: 1 }}>
                キャンセル
              </Button>
              <Button variant="primary" onClick={handleConsentAccept} style={{ flex: 1 }}>
                有効化する
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function IntegrationsTab() {
  const { colors } = useTheme();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeView, setActiveView] = useState<"integrations" | "workflows" | "siem">("integrations");
  const [_showAddDialog, setShowAddDialog] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);

  const manager = useMemo(() => createIntegrationManager(), []);

  const loadData = useCallback(async () => {
    setIntegrations(await manager.getIntegrations());
    setWorkflows(await manager.getWorkflows());
  }, [manager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleIntegration = useCallback(async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;

    await manager.updateIntegration(id, {
      status: integration.status === "active" ? "inactive" : "active",
    });
    await loadData();
  }, [manager, integrations, loadData]);

  const handleTestIntegration = useCallback(async (id: string) => {
    await manager.testIntegration(id);
    await loadData();
  }, [manager, loadData]);

  const handleDeleteIntegration = useCallback(async (id: string) => {
    if (!confirm("この連携を削除しますか？")) return;
    await manager.removeIntegration(id);
    await loadData();
  }, [manager, loadData]);

  const handleEditIntegration = useCallback((integration: Integration) => {
    setEditingIntegration(integration);
  }, []);

  const handleSaveIntegration = useCallback(async (id: string, config: IntegrationConfig) => {
    await manager.updateIntegration(id, { config });
    setEditingIntegration(null);
    await loadData();
  }, [manager, loadData]);

  const handleToggleWorkflow = useCallback(async (id: string) => {
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;

    await manager.updateWorkflow(id, { enabled: !workflow.enabled });
    await loadData();
  }, [manager, workflows, loadData]);

  const handleRunWorkflow = useCallback(async (id: string) => {
    await manager.runWorkflow(id);
    await loadData();
  }, [manager, loadData]);

  const handleDeleteWorkflow = useCallback(async (id: string) => {
    if (!confirm("このワークフローを削除しますか？")) return;
    await manager.removeWorkflow(id);
    await loadData();
  }, [manager, loadData]);

  const handleAddIntegration = useCallback(async (type: IntegrationType) => {
    const template = INTEGRATION_TEMPLATES.find((t) => t.type === type);
    if (!template) return;

    let config: IntegrationConfig;
    if (type === "slack") {
      config = {
        type: "slack",
        webhookUrl: "https://hooks.slack.com/services/...",
        channel: "#security-alerts",
      } as SlackConfig;
    } else {
      config = {
        type: "webhook",
        url: "https://example.com/webhook",
        method: "POST",
      } as WebhookConfig;
    }

    await manager.addIntegration(
      template.name,
      type,
      config,
      [
        { event: "threat_detected", enabled: true },
        { event: "policy_violation", enabled: true },
      ]
    );
    await loadData();
    setShowAddDialog(false);
  }, [manager, loadData]);

  const handleAddWorkflow = useCallback(async (templateIndex: number) => {
    const template = WORKFLOW_TEMPLATES[templateIndex];
    if (!template) return;

    await manager.addWorkflow({
      name: template.name,
      description: template.description,
      enabled: false,
      trigger: template.trigger,
      actions: template.actions.map((a, i) => ({ ...a, id: `action_${i}` })),
    });
    await loadData();
  }, [manager, loadData]);

  const activeIntegrations = integrations.filter((i) => i.status === "active").length;
  const activeWorkflows = workflows.filter((w) => w.enabled).length;

  return (
    <div>
      {/* Edit Dialog */}
      {editingIntegration && (
        <EditDialog
          integration={editingIntegration}
          onSave={handleSaveIntegration}
          onClose={() => setEditingIntegration(null)}
        />
      )}

      {/* Stats */}
      <div style={{ marginBottom: spacing.xl }}>
        <StatsGrid>
          <StatCard value={integrations.length} label="連携" />
          <StatCard value={activeIntegrations} label="アクティブ連携" />
          <StatCard value={workflows.length} label="ワークフロー" />
          <StatCard value={activeWorkflows} label="アクティブWF" />
        </StatsGrid>
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <Button
          variant={activeView === "integrations" ? "primary" : "secondary"}
          onClick={() => setActiveView("integrations")}
        >
          <Plug size={14} style={{ marginRight: "6px" }} />
          連携 ({integrations.length})
        </Button>
        <Button
          variant={activeView === "workflows" ? "primary" : "secondary"}
          onClick={() => setActiveView("workflows")}
        >
          <Zap size={14} style={{ marginRight: "6px" }} />
          ワークフロー ({workflows.length})
        </Button>
        <Button
          variant={activeView === "siem" ? "primary" : "secondary"}
          onClick={() => setActiveView("siem")}
        >
          <Server size={14} style={{ marginRight: "6px" }} />
          SIEM
        </Button>
      </div>

      {activeView === "integrations" && (
        <>
          {/* Integration Templates */}
          <Card title="連携を追加" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {INTEGRATION_TEMPLATES.map((template) => (
                <button
                  key={template.type}
                  onClick={() => handleAddIntegration(template.type)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    color: colors.textPrimary,
                    transition: "background-color 0.15s",
                  }}
                >
                  {getIntegrationIcon(template.type)}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 500, fontSize: "13px" }}>{template.name}</div>
                    <div style={{ fontSize: "11px", color: colors.textMuted }}>
                      {template.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Integrations List */}
          <Card title={`設定済み連携 (${integrations.length})`}>
            {integrations.length === 0 ? (
              <EmptyState
                icon={Plug}
                title="連携が設定されていません"
                description="上のテンプレートから連携を追加してください"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onToggle={handleToggleIntegration}
                    onTest={handleTestIntegration}
                    onDelete={handleDeleteIntegration}
                    onEdit={handleEditIntegration}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {activeView === "workflows" && (
        <>
          {/* Workflow Templates */}
          <Card title="ワークフローテンプレート" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {WORKFLOW_TEMPLATES.map((template, index) => (
                <button
                  key={template.name}
                  onClick={() => handleAddWorkflow(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    color: colors.textPrimary,
                    maxWidth: "280px",
                  }}
                >
                  <Zap size={20} color="#3b82f6" />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 500, fontSize: "13px" }}>{template.name}</div>
                    <div style={{ fontSize: "11px", color: colors.textMuted }}>
                      {template.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Workflows List */}
          <Card title={`ワークフロー (${workflows.length})`}>
            {workflows.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="ワークフローが設定されていません"
                description="テンプレートからワークフローを追加してください"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {workflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onToggle={handleToggleWorkflow}
                    onRun={handleRunWorkflow}
                    onDelete={handleDeleteWorkflow}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {activeView === "siem" && <SIEMView colors={colors} />}
    </div>
  );
}
