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
  Plug,
  Play,
  Pause,
  Trash2,
  Zap,
  Mail,
  MessageSquare,
  Globe,
  GitBranch,
} from "lucide-preact";
import { useTheme, spacing, type ThemeColors } from "../../lib/theme";
import { Badge, Button, Card, StatCard, EmptyState, StatsGrid } from "../../components";

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

interface IntegrationCardProps {
  integration: Integration;
  onToggle: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
}

function IntegrationCard({ integration, onToggle, onTest, onDelete }: IntegrationCardProps) {
  const { colors } = useTheme();
  const statusColor = getStatusColor(integration.status, colors);

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
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
            {integration.type} • {integration.triggers.filter(t => t.enabled).length} triggers
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
        <div style={{ display: "flex", gap: "4px" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onTest(integration.id)}
            title="Test"
          >
            <Play size={14} />
          </Button>
          <Button
            size="sm"
            variant={integration.status === "active" ? "primary" : "secondary"}
            onClick={() => onToggle(integration.id)}
            title={integration.status === "active" ? "Disable" : "Enable"}
          >
            {integration.status === "active" ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onDelete(integration.id)}
            title="Delete"
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
        <div style={{ display: "flex", gap: "4px" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRun(workflow.id)}
            title="Run"
            disabled={!workflow.enabled}
          >
            <Play size={14} />
          </Button>
          <Button
            size="sm"
            variant={workflow.enabled ? "primary" : "secondary"}
            onClick={() => onToggle(workflow.id)}
          >
            {workflow.enabled ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onDelete(workflow.id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsTab() {
  const { colors } = useTheme();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeView, setActiveView] = useState<"integrations" | "workflows">("integrations");
  const [_showAddDialog, setShowAddDialog] = useState(false);

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
    </div>
  );
}
