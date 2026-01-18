import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/detectors";
import {
  buildSecurityGraph,
  type SecurityGraph,
  type GraphNode,
  type GraphEdge,
  type AttackPath,
  type RiskLevel,
  getRiskColor,
  riskLevelPriority,
} from "@pleno-audit/security-graph";
import {
  AlertTriangle,
  Network,
  Shield,
  Activity,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-preact";
import { useTheme, spacing } from "../../lib/theme";
import { Badge, Card, SearchInput, Select, StatCard, LoadingState, EmptyState, StatsGrid } from "../../components";

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const variants: Record<RiskLevel, "danger" | "warning" | "info" | "success" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "success",
    info: "default",
  };
  return <Badge variant={variants[level]}>{level}</Badge>;
}

interface NodeCardProps {
  node: GraphNode;
  edges: GraphEdge[];
  onNodeClick: (nodeId: string) => void;
}

function NodeCard({ node, edges, onNodeClick }: NodeCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
  const outgoing = connectedEdges.filter((e) => e.source === node.id);
  const incoming = connectedEdges.filter((e) => e.target === node.id);

  const getNodeIcon = () => {
    switch (node.type) {
      case "domain":
        return <Network size={16} />;
      case "ai_provider":
        return <Activity size={16} />;
      case "extension":
        return <Shield size={16} />;
      case "data_type":
        return <AlertTriangle size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getNodeDetails = () => {
    if (node.metadata.type === "domain") {
      const m = node.metadata;
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
          {m.hasLogin && <Badge variant="warning" size="sm">ログイン</Badge>}
          {m.isNRD && <Badge variant="danger" size="sm">NRD</Badge>}
          {m.isTyposquat && <Badge variant="warning" size="sm">Typosquat</Badge>}
          {m.hasPrivacyPolicy && <Badge variant="success" size="sm">PP有</Badge>}
          {m.hasTermsOfService && <Badge variant="success" size="sm">ToS有</Badge>}
          {m.cookieCount > 0 && <Badge size="sm">{m.cookieCount} cookies</Badge>}
        </div>
      );
    }
    if (node.metadata.type === "ai_provider") {
      const m = node.metadata;
      return (
        <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "8px" }}>
          <div>プロンプト: {m.promptCount}回</div>
          <div>モデル: {m.models.join(", ") || "不明"}</div>
        </div>
      );
    }
    if (node.metadata.type === "extension") {
      const m = node.metadata;
      return (
        <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "8px" }}>
          <div>リクエスト: {m.requestCount}回</div>
          <div>接続先: {m.uniqueDomains}ドメイン</div>
        </div>
      );
    }
    if (node.metadata.type === "data_type") {
      const m = node.metadata;
      return (
        <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "8px" }}>
          <div>検出: {m.occurrences}回</div>
          <div>ドメイン: {m.domains.slice(0, 3).join(", ")}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${node.riskLevel === "critical" || node.riskLevel === "high"
          ? getRiskColor(node.riskLevel)
          : colors.border}`,
        padding: "12px",
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ color: getRiskColor(node.riskLevel) }}>{getNodeIcon()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 500, fontSize: "13px" }}>{truncate(node.label, 30)}</span>
            <RiskBadge level={node.riskLevel} />
          </div>
          <div style={{ fontSize: "11px", color: colors.textSecondary }}>
            スコア: {node.riskScore} | {node.type}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: colors.textSecondary }}>
          <span>→{outgoing.length}</span>
          <span>←{incoming.length}</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {getNodeDetails()}

      {expanded && connectedEdges.length > 0 && (
        <div style={{ marginTop: "12px", borderTop: `1px solid ${colors.border}`, paddingTop: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, marginBottom: "8px" }}>接続</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {connectedEdges.slice(0, 5).map((edge) => {
              const isOutgoing = edge.source === node.id;
              const targetId = isOutgoing ? edge.target : edge.source;
              return (
                <div
                  key={edge.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    padding: "4px 8px",
                    background: colors.bgSecondary,
                    borderRadius: "4px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeClick(targetId);
                  }}
                >
                  <span style={{ color: colors.textSecondary }}>{isOutgoing ? "→" : "←"}</span>
                  <span style={{ fontFamily: "monospace" }}>{truncate(targetId.split(":")[1], 20)}</span>
                  <Badge size="sm">{edge.type}</Badge>
                  {edge.metadata.hasCredentials && <Badge variant="danger" size="sm">認証情報</Badge>}
                  {edge.metadata.hasPII && <Badge variant="warning" size="sm">PII</Badge>}
                </div>
              );
            })}
            {connectedEdges.length > 5 && (
              <div style={{ fontSize: "11px", color: colors.textSecondary, textAlign: "center" }}>
                +{connectedEdges.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AttackPathCardProps {
  path: AttackPath;
  graph: SecurityGraph;
}

function AttackPathCard({ path, graph }: AttackPathCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: "8px",
        border: `1px solid ${getRiskColor(path.riskLevel)}`,
        padding: "12px",
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <AlertTriangle size={16} color={getRiskColor(path.riskLevel)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: "13px" }}>{path.name}</div>
          <div style={{ fontSize: "11px", color: colors.textSecondary }}>{path.description}</div>
        </div>
        <RiskBadge level={path.riskLevel} />
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {expanded && (
        <div style={{ marginTop: "12px", borderTop: `1px solid ${colors.border}`, paddingTop: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, marginBottom: "8px" }}>攻撃パス</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {path.nodes.map((nodeId, i) => {
              const node = graph.nodes.get(nodeId);
              return (
                <div key={nodeId} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {i > 0 && <span style={{ color: colors.textSecondary }}>→</span>}
                  <span
                    style={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      padding: "2px 6px",
                      background: colors.bgSecondary,
                      borderRadius: "4px",
                      border: `1px solid ${node ? getRiskColor(node.riskLevel) : colors.border}`,
                    }}
                  >
                    {truncate(nodeId.split(":")[1], 15)}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "8px", fontSize: "11px", color: colors.textSecondary }}>
            総リスクスコア: {path.totalRiskScore}
          </div>
        </div>
      )}
    </div>
  );
}

export function SecurityGraphTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState<SecurityGraph | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [storageResult, eventsResult] = await Promise.all([
        chrome.storage.local.get(["services"]),
        chrome.runtime.sendMessage({ type: "GET_EVENTS", data: { limit: 1000 } }),
      ]);

      const loadedServices = storageResult.services ? Object.values(storageResult.services) as DetectedService[] : [];
      const loadedEvents = eventsResult?.events ?? [];

      // Build security graph
      const secGraph = buildSecurityGraph(loadedServices, loadedEvents);
      setGraph(secGraph);
    } catch {
      // Failed to load data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredNodes = useMemo(() => {
    if (!graph) return [];

    return Array.from(graph.nodes.values())
      .filter((node) => {
        if (nodeTypeFilter && node.type !== nodeTypeFilter) return false;
        if (riskFilter && node.riskLevel !== riskFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return node.label.toLowerCase().includes(q) || node.type.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by risk level, then by score
        const levelDiff = riskLevelPriority(b.riskLevel) - riskLevelPriority(a.riskLevel);
        if (levelDiff !== 0) return levelDiff;
        return b.riskScore - a.riskScore;
      });
  }, [graph, searchQuery, nodeTypeFilter, riskFilter]);

  const handleNodeClick = (nodeId: string) => {
    setSearchQuery(nodeId.split(":")[1]);
  };

  if (loading) {
    return <LoadingState message="グラフを構築中..." />;
  }

  if (!graph || graph.stats.totalNodes === 0) {
    return (
      <EmptyState
        icon={Network}
        title="データが不足しています"
        description="ブラウザの利用を続けてセキュリティグラフを構築してください。"
      />
    );
  }

  const nodeTypeOptions = [
    { value: "domain", label: "ドメイン" },
    { value: "ai_provider", label: "AIプロバイダ" },
    { value: "extension", label: "拡張機能" },
    { value: "data_type", label: "データタイプ" },
  ];

  const riskOptions = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
    { value: "info", label: "Info" },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={{ marginBottom: spacing.xl }}>
        <StatsGrid>
          <StatCard
            value={graph.stats.totalNodes}
            label="ノード総数"
          />
          <StatCard
            value={graph.stats.totalEdges}
            label="エッジ総数"
          />
          <StatCard
            value={graph.stats.riskDistribution.critical + graph.stats.riskDistribution.high}
            label="高リスクノード"
            trend={
              graph.stats.riskDistribution.critical > 0
                ? { value: graph.stats.riskDistribution.critical, isUp: true }
                : undefined
            }
          />
          <StatCard
            value={graph.stats.criticalPaths.length}
            label="攻撃パス"
          />
        </StatsGrid>
      </div>

      {/* Attack Paths */}
      {graph.stats.criticalPaths.length > 0 && (
        <Card title="検出された攻撃パス" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {graph.stats.criticalPaths.map((path) => (
              <AttackPathCard key={path.id} path={path} graph={graph} />
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="ノードを検索..."
        />
        <Select
          value={nodeTypeFilter}
          onChange={setNodeTypeFilter}
          options={nodeTypeOptions}
          placeholder="ノードタイプ"
        />
        <Select
          value={riskFilter}
          onChange={setRiskFilter}
          options={riskOptions}
          placeholder="リスクレベル"
        />
      </div>

      {/* Risk Distribution */}
      <Card title="リスク分布" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {(Object.entries(graph.stats.riskDistribution) as [RiskLevel, number][])
            .filter(([_, count]) => count > 0)
            .sort((a, b) => riskLevelPriority(b[0]) - riskLevelPriority(a[0]))
            .map(([level, count]) => (
              <div
                key={level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: colors.bgSecondary,
                  borderRadius: "6px",
                  borderLeft: `3px solid ${getRiskColor(level)}`,
                  cursor: "pointer",
                }}
                onClick={() => setRiskFilter(riskFilter === level ? "" : level)}
              >
                <span style={{ fontWeight: 600, fontSize: "16px" }}>{count}</span>
                <span style={{ fontSize: "12px", color: colors.textSecondary }}>{level}</span>
              </div>
            ))}
        </div>
      </Card>

      {/* Data Flow Visualization */}
      <Card title="データフロー" style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "12px" }}>
          ドメイン間のデータ転送を可視化
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {Array.from(graph.edges.values())
            .filter((e) => e.type === "sends_data" || e.type === "ai_prompt" || e.type === "requests")
            .slice(0, 10)
            .map((edge) => {
              const sourceNode = graph.nodes.get(edge.source);
              const targetNode = graph.nodes.get(edge.target);
              const flowColor = edge.metadata.hasCredentials
                ? "#dc2626"
                : edge.metadata.hasPII
                  ? "#f97316"
                  : edge.type === "ai_prompt"
                    ? "#8b5cf6"
                    : "#3b82f6";

              return (
                <div
                  key={edge.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: colors.bgSecondary,
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      padding: "4px 8px",
                      background: colors.bgPrimary,
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      maxWidth: "120px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={sourceNode?.label}
                  >
                    {truncate(sourceNode?.label || edge.source.split(":")[1], 15)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                    <div style={{ flex: 1, height: "2px", background: `linear-gradient(to right, ${flowColor}, ${flowColor}80)` }} />
                    <div style={{ color: flowColor, fontSize: "14px", margin: "0 4px" }}>→</div>
                    <div style={{ flex: 1, height: "2px", background: `linear-gradient(to right, ${flowColor}80, ${flowColor})` }} />
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      background: colors.bgPrimary,
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      maxWidth: "120px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={targetNode?.label}
                  >
                    {truncate(targetNode?.label || edge.target.split(":")[1], 15)}
                  </div>
                  <Badge size="sm" variant={edge.type === "ai_prompt" ? "info" : "default"}>
                    {edge.type === "sends_data" ? "データ" : edge.type === "ai_prompt" ? "AI" : "リクエスト"}
                  </Badge>
                  {edge.metadata.hasCredentials && <Badge size="sm" variant="danger">認証</Badge>}
                  {edge.metadata.hasPII && <Badge size="sm" variant="warning">PII</Badge>}
                </div>
              );
            })}
          {Array.from(graph.edges.values()).filter((e) => e.type === "sends_data" || e.type === "ai_prompt" || e.type === "requests").length === 0 && (
            <div style={{ textAlign: "center", padding: "16px", color: colors.textMuted }}>
              データフローは検出されていません
            </div>
          )}
        </div>
      </Card>

      {/* Node Grid */}
      <Card title={`ノード一覧 (${filteredNodes.length})`}>
        {filteredNodes.length === 0 ? (
          <EmptyState
            icon={Network}
            title="該当するノードがありません"
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "12px",
            }}
          >
            {filteredNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                edges={Array.from(graph.edges.values())}
                onNodeClick={handleNodeClick}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
