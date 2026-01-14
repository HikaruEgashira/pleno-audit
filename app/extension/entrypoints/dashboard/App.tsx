import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import type {
  CSPViolation,
  NetworkRequest,
  CSPReport,
} from "@pleno-audit/csp";
import type {
  CapturedAIPrompt,
  DetectedService,
  EventLog,
} from "@pleno-audit/detectors";
import { Shield } from "lucide-preact";
import { ThemeContext, useThemeState, useTheme, type ThemeColors, spacing } from "../../lib/theme";
import { Badge, Button, Card, DataTable, SearchInput, Select, SettingsMenu, StatCard, Sidebar, LoadingState, StatsGrid } from "../../components";
import { UnifiedExtensionsTab } from "./UnifiedExtensionsTab";
import { SecurityGraphTab } from "./SecurityGraphTab";
import { PolicyTab } from "./PolicyTab";
import { ThreatTab } from "./ThreatTab";
import { ReportTab } from "./ReportTab";
import { RiskPriorityTab } from "./RiskPriorityTab";
import { IntegrationsTab } from "./IntegrationsTab";

interface TotalCounts {
  violations: number;
  networkRequests: number;
  events: number;
  aiPrompts: number;
}

type Period = "1h" | "24h" | "7d" | "30d" | "all";
type TabType = "overview" | "violations" | "network" | "domains" | "ai" | "services" | "events" | "extensions" | "graph" | "policy" | "threats" | "reports" | "risks" | "integrations";

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

function getPeriodMs(period: Period): number {
  switch (period) {
    case "1h": return 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d": return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
    default: return Number.MAX_SAFE_INTEGER;
  }
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return {
    wrapper: {
      display: "flex",
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
    container: {
      flex: 1,
      maxWidth: "1200px",
      padding: "24px",
      overflowY: "auto",
    },
    header: {
      marginBottom: "32px",
    },
    headerTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
    },
    title: {
      fontSize: "20px",
      fontWeight: 600,
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: "13px",
      marginTop: "4px",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "12px",
      marginBottom: "24px",
    },
    filterBar: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "16px",
      flexWrap: "wrap" as const,
    },
    section: {
      marginBottom: "32px",
    },
    twoColumn: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
      marginBottom: "24px",
    },
    chartContainer: {
      height: "200px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    },
    chartBar: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    chartLabel: {
      fontSize: "12px",
      color: colors.textSecondary,
      width: "100px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    chartBarInner: {
      height: "20px",
      background: colors.interactive,
      borderRadius: "4px",
      minWidth: "4px",
    },
    chartValue: {
      fontSize: "12px",
      color: colors.textSecondary,
      minWidth: "40px",
    },
    eventItem: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "10px 12px",
      background: colors.bgSecondary,
      borderRadius: "6px",
    },
    eventTime: {
      fontSize: "12px",
      color: colors.textSecondary,
      minWidth: "70px",
    },
    code: {
      fontSize: "12px",
      fontFamily: "monospace",
      flex: 1,
      color: colors.textPrimary,
    },
    link: {
      color: isDark ? "#60a5fa" : "#0070f3",
      fontSize: "12px",
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center" as const,
      padding: "24px",
    },
  };
}

const periodOptions = [
  { value: "1h", label: "1時間" },
  { value: "24h", label: "24時間" },
  { value: "7d", label: "7日" },
  { value: "30d", label: "30日" },
  { value: "all", label: "全期間" },
];

function getStatusBadge(nrdCount: number, violationCount: number, aiCount: number) {
  if (nrdCount > 0) return { variant: "danger" as const, label: "要対応", dot: false };
  if (violationCount > 50) return { variant: "warning" as const, label: "注意", dot: false };
  if (aiCount > 0) return { variant: "info" as const, label: "監視中", dot: false };
  return { variant: "success" as const, label: "正常", dot: true };
}

function HorizontalBarChart({ data, title, colors, isDark }: { data: { label: string; value: number }[]; title: string; colors: ThemeColors; isDark: boolean }) {
  const styles = createStyles(colors, isDark);
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const displayData = data.slice(0, 8);

  return (
    <Card title={title}>
      {displayData.length === 0 ? (
        <p style={styles.emptyText}>データなし</p>
      ) : (
        <div style={styles.chartContainer}>
          {displayData.map((item, i) => (
            <div key={i} style={styles.chartBar}>
              <span style={styles.chartLabel} title={item.label}>{truncate(item.label, 15)}</span>
              <div
                style={{
                  ...styles.chartBarInner,
                  width: `${(item.value / maxValue) * 100}%`,
                  maxWidth: "calc(100% - 160px)",
                }}
              />
              <span style={styles.chartValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DashboardContent() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const [reports, setReports] = useState<CSPReport[]>([]);
  const [totalCounts, setTotalCounts] = useState<TotalCounts>({ violations: 0, networkRequests: 0, events: 0, aiPrompts: 0 });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<"local" | "remote">("local");

  const getInitialTab = (): TabType => {
    const hash = window.location.hash.slice(1);
    const validTabs: TabType[] = ["overview", "violations", "network", "domains", "ai", "services", "events", "extensions", "graph", "policy", "threats", "reports", "risks", "integrations"];
    // permissionsはextensionsに統合されたのでリダイレクト
    if (hash === "permissions") return "extensions";
    return validTabs.includes(hash as TabType) ? (hash as TabType) : "overview";
  };

  const [period, setPeriod] = useState<Period>("24h");
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [directiveFilter, setDirectiveFilter] = useState("");
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [services, setServices] = useState<DetectedService[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validTabs: TabType[] = ["overview", "violations", "network", "domains", "ai", "services", "events", "extensions", "graph", "policy", "threats", "reports", "risks", "integrations"];
      if (hash === "permissions") {
        setActiveTab("extensions");
      } else if (validTabs.includes(hash as TabType)) {
        setActiveTab(hash as TabType);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const cutoffMs = Date.now() - getPeriodMs(period);
      // CSP API用はISO文字列、EventStore用は数値タイムスタンプ
      const sinceISO = period !== "all" ? new Date(cutoffMs).toISOString() : undefined;
      const sinceTs = period !== "all" ? cutoffMs : undefined;

      // 各API呼び出しを個別にエラーハンドリング
      const safeMessage = async <T,>(msg: object, fallback: T): Promise<T> => {
        try {
          return await chrome.runtime.sendMessage(msg) ?? fallback;
        } catch {
          return fallback;
        }
      };

      const [violationsResult, networkResult, configResult, aiPromptsResult, storageResult, eventsResult, eventsCountResult, aiPromptsCountResult] = await Promise.all([
        safeMessage({ type: "GET_CSP_REPORTS", data: { type: "csp-violation", since: sinceISO, limit: 500 } }, { reports: [], total: 0 }),
        safeMessage({ type: "GET_CSP_REPORTS", data: { type: "network-request", since: sinceISO, limit: 500 } }, { reports: [], total: 0 }),
        safeMessage({ type: "GET_CONNECTION_CONFIG" }, { mode: "local" }),
        safeMessage({ type: "GET_AI_PROMPTS" }, []),
        chrome.storage.local.get(["services"]),
        safeMessage({ type: "GET_EVENTS", data: { since: sinceTs, limit: 500 } }, { events: [], total: 0 }),
        safeMessage({ type: "GET_EVENTS_COUNT", data: { since: sinceTs } }, { count: 0 }),
        safeMessage({ type: "GET_AI_PROMPTS_COUNT" }, { count: 0 }),
      ]);

      // Combine violations and network into reports
      const violationsData = Array.isArray(violationsResult) ? violationsResult : (violationsResult?.reports ?? []);
      const networkData = Array.isArray(networkResult) ? networkResult : (networkResult?.reports ?? []);
      setReports([...violationsData, ...networkData]);

      // Get totals from API response
      const violationsTotal = violationsResult?.total ?? violationsData.length;
      const networkTotal = networkResult?.total ?? networkData.length;
      setTotalCounts((prev) => ({
        ...prev,
        violations: violationsTotal,
        networkRequests: networkTotal,
      }));

      if (configResult) setConnectionMode(configResult.mode as "local" | "remote");
      if (Array.isArray(aiPromptsResult)) setAIPrompts(aiPromptsResult);
      if (storageResult.services) setServices(Object.values(storageResult.services));
      if (eventsResult && Array.isArray(eventsResult.events)) setEvents(eventsResult.events);
      if (eventsCountResult) {
        setTotalCounts((prev) => ({ ...prev, events: eventsCountResult.count ?? 0 }));
      }
      if (aiPromptsCountResult) {
        setTotalCounts((prev) => ({ ...prev, aiPrompts: aiPromptsCountResult.count ?? 0 }));
      }
      setLastUpdated(new Date().toISOString());
    } catch {
      // Failed to load data
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIds: TabType[] = ["overview", "violations", "domains", "ai", "services", "network", "events", "extensions", "graph", "policy", "threats", "reports"];
        const idx = parseInt(e.key) - 1;
        if (tabIds[idx]) setActiveTab(tabIds[idx]);
      }
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) loadData();
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        (document.querySelector('input[type="text"]') as HTMLInputElement)?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setDirectiveFilter("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadData]);

  const handleClearData = async () => {
    if (!confirm("すべてのデータを削除しますか？")) return;
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await loadData();
    } catch {
      // Failed to clear data
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ reports, services, events, aiPrompts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // データはサーバー側で期間フィルタリング済み
  const filteredReports = reports;

  const violations = useMemo(
    () => filteredReports.filter((r) => r.type === "csp-violation") as CSPViolation[],
    [filteredReports]
  );

  const networkRequests = useMemo(
    () => filteredReports.filter((r) => r.type === "network-request") as NetworkRequest[],
    [filteredReports]
  );

  const directives = useMemo(() => Array.from(new Set(violations.map((v) => v.directive))).sort(), [violations]);

  const directiveStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const v of violations) stats[v.directive || "unknown"] = (stats[v.directive || "unknown"] ?? 0) + 1;
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [violations]);

  const domainStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const v of violations) {
      try {
        const domain = new URL(v.blockedURL).hostname;
        stats[domain] = (stats[domain] ?? 0) + 1;
      } catch { /* invalid URL */ }
    }
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [violations]);

  if (loading) {
    return (
      <div style={styles.container}>
        <LoadingState />
      </div>
    );
  }

  const nrdServices = services.filter((s) => s.nrdResult?.isNRD);
  const loginServices = services.filter((s) => s.hasLoginPage);
  const status = getStatusBadge(nrdServices.length, violations.length, aiPrompts.length);

  const tabs = [
    { id: "overview", label: "概要" },
    { id: "violations", label: "CSP違反" },
    { id: "domains", label: "ドメイン" },
    { id: "ai", label: "AI監視" },
    { id: "services", label: "サービス" },
    { id: "network", label: "ネットワーク" },
    { id: "events", label: "イベント" },
    { id: "extensions", label: "拡張機能" },
    { id: "graph", label: "グラフ" },
    { id: "policy", label: "ポリシー" },
    { id: "threats", label: "脅威検出" },
    { id: "reports", label: "レポート" },
    { id: "risks", label: "リスク優先度" },
    { id: "integrations", label: "連携" },
  ];

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (directiveFilter && v.directive !== directiveFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return v.pageUrl.toLowerCase().includes(q) || v.blockedURL.toLowerCase().includes(q) || v.directive.toLowerCase().includes(q);
      }
      return true;
    });
  }, [violations, searchQuery, directiveFilter]);

  const filteredNetworkRequests = useMemo(() => {
    if (!searchQuery) return networkRequests;
    const q = searchQuery.toLowerCase();
    return networkRequests.filter((r) => r.url.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q));
  }, [networkRequests, searchQuery]);

  const filteredAIPrompts = useMemo(() => {
    if (!searchQuery) return aiPrompts;
    const q = searchQuery.toLowerCase();
    return aiPrompts.filter((p) =>
      p.provider?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.apiEndpoint.toLowerCase().includes(q)
    );
  }, [aiPrompts, searchQuery]);

  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const q = searchQuery.toLowerCase();
    if (q === "nrd") return services.filter((s) => s.nrdResult?.isNRD);
    if (q === "login") return services.filter((s) => s.hasLoginPage);
    return services.filter((s) => s.domain.toLowerCase().includes(q));
  }, [services, searchQuery]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((e) => e.type.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q));
  }, [events, searchQuery]);

  return (
    <div style={styles.wrapper}>
      <Sidebar tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <h1 style={styles.title}>
                <Shield size={20} />
                Pleno Audit
                <Badge variant={status.variant} size="md" dot={status.dot}>{status.label}</Badge>
              </h1>
              <p style={styles.subtitle}>
                更新: {new Date(lastUpdated).toLocaleString("ja-JP")} | 接続: {connectionMode}
              </p>
            </div>
            <div style={styles.controls}>
              <Select
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={periodOptions}
              />
              <Button onClick={() => loadData()} disabled={isRefreshing}>
                {isRefreshing ? "更新中..." : "更新"}
              </Button>
              <SettingsMenu onClearData={handleClearData} onExport={handleExportJSON} />
            </div>
          </div>

          <div style={{ marginBottom: spacing.xl }}>
            <StatsGrid minWidth="lg">
              <StatCard value={totalCounts.violations} label="CSP違反" onClick={() => setActiveTab("violations")} />
              <StatCard value={nrdServices.length} label="NRD検出" trend={nrdServices.length > 0 ? { value: nrdServices.length, isUp: true } : undefined} onClick={() => { setActiveTab("services"); setSearchQuery("nrd"); }} />
              <StatCard value={totalCounts.aiPrompts} label="AIプロンプト" onClick={() => setActiveTab("ai")} />
              <StatCard value={services.length} label="サービス" onClick={() => setActiveTab("services")} />
              <StatCard value={loginServices.length} label="ログイン検出" onClick={() => { setActiveTab("services"); setSearchQuery("login"); }} />
              <StatCard value={totalCounts.events} label="イベント" onClick={() => setActiveTab("events")} />
            </StatsGrid>
          </div>
        </header>

      {activeTab === "overview" && (
        <>
          {/* Security Score Card */}
          <Card title="セキュリティスコア" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: "48px",
                  fontWeight: 700,
                  color: nrdServices.length === 0 && violations.length < 10 ? "#22c55e" : nrdServices.length > 0 ? "#dc2626" : "#f97316",
                }}>
                  {Math.max(0, 100 - nrdServices.length * 20 - Math.floor(violations.length / 10) * 5 - services.filter(s => s.typosquatResult?.isTyposquat).length * 30)}
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>/ 100</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: nrdServices.length > 0 ? "#dc2626" : "#22c55e" }} />
                  <span style={{ fontSize: "13px" }}>NRD検出: {nrdServices.length}件</span>
                  {nrdServices.length > 0 && <Badge variant="danger" size="sm">-{nrdServices.length * 20}pt</Badge>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: services.filter(s => s.typosquatResult?.isTyposquat).length > 0 ? "#dc2626" : "#22c55e" }} />
                  <span style={{ fontSize: "13px" }}>Typosquat: {services.filter(s => s.typosquatResult?.isTyposquat).length}件</span>
                  {services.filter(s => s.typosquatResult?.isTyposquat).length > 0 && <Badge variant="danger" size="sm">-{services.filter(s => s.typosquatResult?.isTyposquat).length * 30}pt</Badge>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: violations.length > 50 ? "#f97316" : "#22c55e" }} />
                  <span style={{ fontSize: "13px" }}>CSP違反: {violations.length}件</span>
                  {violations.length >= 10 && <Badge variant="warning" size="sm">-{Math.floor(violations.length / 10) * 5}pt</Badge>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: aiPrompts.length > 0 ? "#3b82f6" : "#6b7280" }} />
                  <span style={{ fontSize: "13px" }}>AI利用: {aiPrompts.length}件</span>
                  <Badge variant="info" size="sm">監視中</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Risk Trend - 7 Day Activity */}
          <Card title="7日間のアクティビティ" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
              {(() => {
                const days = 7;
                const dayData: number[] = [];
                const now = Date.now();
                for (let i = days - 1; i >= 0; i--) {
                  const dayStart = now - (i + 1) * 24 * 60 * 60 * 1000;
                  const dayEnd = now - i * 24 * 60 * 60 * 1000;
                  const count = events.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
                  dayData.push(count);
                }
                const maxCount = Math.max(...dayData, 1);
                const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];
                const todayIndex = new Date().getDay();
                return dayData.map((count, i) => {
                  const dayOfWeek = (todayIndex - (days - 1 - i) + 7) % 7;
                  const height = Math.max(4, (count / maxCount) * 60);
                  const hasRisk = events.filter((e) => {
                    const dayStart = now - (days - i) * 24 * 60 * 60 * 1000;
                    const dayEnd = now - (days - 1 - i) * 24 * 60 * 60 * 1000;
                    return e.timestamp >= dayStart && e.timestamp < dayEnd && (e.type.includes("nrd") || e.type.includes("typosquat"));
                  }).length > 0;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <div
                        style={{
                          width: "100%",
                          height: `${height}px`,
                          background: hasRisk ? "#dc2626" : count > 0 ? colors.interactive : colors.bgSecondary,
                          borderRadius: "4px 4px 0 0",
                        }}
                        title={`${count}件`}
                      />
                      <span style={{ fontSize: "10px", color: colors.textSecondary }}>{dayLabels[dayOfWeek]}</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: colors.textSecondary }}>
              <span>7日前</span>
              <span>今日</span>
            </div>
          </Card>

          <div style={styles.twoColumn}>
            <HorizontalBarChart data={directiveStats} title="Directive別違反数" colors={colors} isDark={isDark} />
            <HorizontalBarChart data={domainStats} title="ドメイン別違反数" colors={colors} isDark={isDark} />
          </div>

          <Card title="最近のイベント">
            {events.slice(0, 10).length === 0 ? (
              <p style={styles.emptyText}>イベントなし</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {events.slice(0, 10).map((e) => (
                  <div key={e.id} style={styles.eventItem}>
                    <span style={styles.eventTime}>
                      {new Date(e.timestamp).toLocaleTimeString("ja-JP")}
                    </span>
                    <Badge
                      variant={
                        e.type.includes("violation") || e.type.includes("nrd")
                          ? "danger"
                          : e.type.includes("ai") || e.type.includes("login")
                            ? "warning"
                            : "default"
                      }
                    >
                      {e.type}
                    </Badge>
                    <code style={styles.code}>{e.domain}</code>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Security Recommendations */}
          <Card title="セキュリティ推奨事項" style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {nrdServices.length > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #dc2626",
                }}>
                  <Badge variant="danger">Critical</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "4px" }}>NRDサイトへのアクセスを確認</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      {nrdServices.map(s => s.domain).join(", ")} への接続が検出されました。
                      これらは新規登録ドメインであり、フィッシングの可能性があります。
                    </div>
                  </div>
                </div>
              )}
              {services.filter(s => s.typosquatResult?.isTyposquat).length > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #dc2626",
                }}>
                  <Badge variant="danger">Critical</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "4px" }}>タイポスクワットの疑い</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      {services.filter(s => s.typosquatResult?.isTyposquat).map(s => s.domain).join(", ")} は
                      正規サイトの偽装の可能性があります。URLを再確認してください。
                    </div>
                  </div>
                </div>
              )}
              {services.filter(s => !s.privacyPolicyUrl).length > 5 && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #f97316",
                }}>
                  <Badge variant="warning">High</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "4px" }}>プライバシーポリシー未確認のサイト</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      {services.filter(s => !s.privacyPolicyUrl).length}件のサイトでプライバシーポリシーが確認できません。
                      個人情報の取り扱いに注意してください。
                    </div>
                  </div>
                </div>
              )}
              {aiPrompts.length > 10 && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #3b82f6",
                }}>
                  <Badge variant="info">Info</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "4px" }}>AI利用の監視</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      {aiPrompts.length}件のAIプロンプトが記録されています。
                      機密情報をAIに送信していないか確認してください。
                    </div>
                  </div>
                </div>
              )}
              {violations.length > 50 && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #eab308",
                }}>
                  <Badge variant="warning">Medium</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "4px" }}>CSP違反の増加</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      {violations.length}件のCSP違反が検出されています。
                      サードパーティスクリプトの監視を強化することを推奨します。
                    </div>
                  </div>
                </div>
              )}
              {nrdServices.length === 0 && services.filter(s => s.typosquatResult?.isTyposquat).length === 0 && violations.length < 50 && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #22c55e",
                }}>
                  <Badge variant="success">Good</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "4px" }}>セキュリティ状態は良好です</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      重大なセキュリティリスクは検出されていません。引き続き監視を継続します。
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {activeTab === "violations" && (
        <div style={styles.section}>
          <div style={styles.filterBar}>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL、ドメインで検索..." />
            <Select
              value={directiveFilter}
              onChange={setDirectiveFilter}
              options={directives.map((d) => ({ value: d, label: d }))}
              placeholder="Directive"
            />
          </div>
          <DataTable
            data={filteredViolations}
            rowKey={(v, i) => `${v.timestamp}-${i}`}
            rowHighlight={(v) => ["script-src", "default-src"].includes(v.directive)}
            emptyMessage="CSP違反は記録されていません"
            columns={[
              { key: "timestamp", header: "日時", width: "160px", render: (v) => new Date(v.timestamp).toLocaleString("ja-JP") },
              { key: "page", header: "ページ", render: (v) => <span title={v.pageUrl}>{truncate(v.pageUrl, 40)}</span> },
              { key: "directive", header: "Directive", width: "120px", render: (v) => <Badge variant={["script-src", "default-src"].includes(v.directive) ? "danger" : "default"}>{v.directive}</Badge> },
              { key: "blocked", header: "ブロックURL", render: (v) => <span title={v.blockedURL}>{truncate(v.blockedURL, 40)}</span> },
            ]}
          />
        </div>
      )}

      {activeTab === "network" && (
        <div style={styles.section}>
          <div style={styles.filterBar}>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL、ドメインで検索..." />
          </div>
          <DataTable
            data={filteredNetworkRequests}
            rowKey={(r, i) => `${r.timestamp}-${i}`}
            emptyMessage="ネットワークリクエストは記録されていません"
            columns={[
              { key: "timestamp", header: "日時", width: "160px", render: (r) => new Date(r.timestamp).toLocaleString("ja-JP") },
              { key: "initiator", header: "Type", width: "80px", render: (r) => <Badge>{r.initiator}</Badge> },
              { key: "method", header: "Method", width: "80px", render: (r) => <code style={{ fontSize: "11px" }}>{r.method || "GET"}</code> },
              { key: "domain", header: "ドメイン", width: "160px", render: (r) => r.domain },
              { key: "url", header: "URL", render: (r) => <span title={r.url}>{truncate(r.url, 50)}</span> },
            ]}
          />
        </div>
      )}

      {activeTab === "domains" && (
        <div style={styles.section}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <Button
              onClick={async () => {
                try {
                  const policy = await chrome.runtime.sendMessage({ type: "GENERATE_CSP" });
                  if (policy?.policyString) {
                    const blob = new Blob([policy.policyString], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `csp-policy-${new Date().toISOString().slice(0, 10)}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                } catch {
                  // CSP generation error
                }
              }}
            >
              CSPポリシー生成
            </Button>
          </div>

          <DataTable
            data={domainStats.map((d, i) => {
              const domainViolations = violations.filter((v) => { try { return new URL(v.blockedURL).hostname === d.label; } catch { return false; } });
              const timestamps = domainViolations.map((v) => new Date(v.timestamp).getTime());
              const lastSeenMs = timestamps.length > 0 ? Math.max(...timestamps) : 0;
              return {
                ...d,
                requests: networkRequests.filter((r) => r.domain === d.label).length,
                lastSeen: lastSeenMs,
                index: i,
              };
            })}
            rowKey={(d) => d.label}
            rowHighlight={(d) => d.value > 10}
            emptyMessage="ドメインデータなし"
            columns={[
              { key: "domain", header: "ドメイン", render: (d) => <code style={{ fontSize: "12px" }}>{d.label}</code> },
              { key: "violations", header: "違反数", width: "100px", render: (d) => d.value > 0 ? <Badge variant="danger">{d.value}</Badge> : "-" },
              { key: "requests", header: "リクエスト数", width: "120px", render: (d) => d.requests },
              { key: "lastSeen", header: "最終検出", width: "160px", render: (d) => d.lastSeen ? new Date(d.lastSeen).toLocaleString("ja-JP") : "-" },
            ]}
          />
        </div>
      )}

      {activeTab === "ai" && (
        <div style={styles.section}>
          <div style={styles.filterBar}>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Provider、Model、エンドポイントで検索..." />
          </div>
          <DataTable
            data={filteredAIPrompts}
            rowKey={(p) => p.id}
            emptyMessage="AIプロンプトは記録されていません"
            columns={[
              { key: "timestamp", header: "日時", width: "160px", render: (p) => new Date(p.timestamp).toLocaleString("ja-JP") },
              { key: "provider", header: "Provider", width: "100px", render: (p) => <Badge>{p.provider || "unknown"}</Badge> },
              { key: "model", header: "Model", width: "120px", render: (p) => <code style={{ fontSize: "11px" }}>{p.model || "-"}</code> },
              { key: "prompt", header: "プロンプト", render: (p) => truncate(p.prompt.messages?.[0]?.content || p.prompt.text || "", 50) },
              { key: "latency", header: "レスポンス", width: "100px", render: (p) => p.response ? <Badge>{p.response.latencyMs}ms</Badge> : "-" },
            ]}
          />
        </div>
      )}

      {activeTab === "services" && (
        <div style={styles.section}>
          <div style={styles.filterBar}>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="ドメインで検索..." />
            <Button variant={searchQuery === "nrd" ? "primary" : "secondary"} size="sm" onClick={() => setSearchQuery(searchQuery === "nrd" ? "" : "nrd")}>
              NRD ({nrdServices.length})
            </Button>
            <Button variant={searchQuery === "login" ? "primary" : "secondary"} size="sm" onClick={() => setSearchQuery(searchQuery === "login" ? "" : "login")}>
              ログイン ({loginServices.length})
            </Button>
          </div>
          <DataTable
            data={filteredServices}
            rowKey={(s) => s.domain}
            rowHighlight={(s) => s.nrdResult?.isNRD === true}
            emptyMessage="検出されたサービスはありません"
            columns={[
              { key: "domain", header: "ドメイン", render: (s) => <code style={{ fontSize: "12px" }}>{s.domain}</code> },
              { key: "login", header: "ログイン", width: "80px", render: (s) => s.hasLoginPage ? <Badge variant="warning">検出</Badge> : "-" },
              { key: "privacy", header: "プライバシーポリシー", width: "160px", render: (s) => s.privacyPolicyUrl ? <a href={s.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>{truncate(s.privacyPolicyUrl, 25)}</a> : "-" },
              { key: "tos", header: "利用規約", width: "140px", render: (s) => s.termsOfServiceUrl ? <a href={s.termsOfServiceUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>{truncate(s.termsOfServiceUrl, 20)}</a> : "-" },
              { key: "nrd", header: "NRD", width: "100px", render: (s) => s.nrdResult?.isNRD ? <Badge variant="danger">NRD</Badge> : "-" },
              { key: "detected", header: "検出日時", width: "140px", render: (s) => new Date(s.detectedAt).toLocaleDateString("ja-JP") },
            ]}
          />
        </div>
      )}

      {activeTab === "events" && (
        <div style={styles.section}>
          <div style={styles.filterBar}>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="イベントタイプ、ドメインで検索..." />
            <Select
              value={searchQuery}
              onChange={setSearchQuery}
              options={[
                { value: "csp_violation", label: "CSP違反" },
                { value: "login_detected", label: "ログイン検出" },
                { value: "ai_prompt_sent", label: "AIプロンプト" },
                { value: "nrd_detected", label: "NRD検出" },
              ]}
              placeholder="タイプ"
            />
          </div>
          <DataTable
            data={filteredEvents}
            rowKey={(e) => e.id}
            emptyMessage="イベントは記録されていません"
            columns={[
              { key: "timestamp", header: "日時", width: "160px", render: (e) => new Date(e.timestamp).toLocaleString("ja-JP") },
              { key: "type", header: "タイプ", width: "140px", render: (e) => <Badge variant={e.type.includes("violation") || e.type.includes("nrd") ? "danger" : e.type.includes("ai") || e.type.includes("login") ? "warning" : "default"}>{e.type}</Badge> },
              { key: "domain", header: "ドメイン", width: "200px", render: (e) => <code style={{ fontSize: "12px" }}>{e.domain}</code> },
              {
                key: "details", header: "詳細", render: (e) => {
                  const d = e.details as Record<string, unknown>;
                  if (!d) return "-";
                  if (e.type === "csp_violation") return `${d.directive}: ${truncate(String(d.blockedURL || ""), 30)}`;
                  if (e.type === "ai_prompt_sent") return `${d.provider}/${d.model}`;
                  return JSON.stringify(d).substring(0, 50);
                }
              },
            ]}
          />
        </div>
      )}

      {activeTab === "extensions" && (
        <div style={styles.section}>
          <UnifiedExtensionsTab />
        </div>
      )}

      {activeTab === "graph" && (
        <div style={styles.section}>
          <SecurityGraphTab />
        </div>
      )}

      {activeTab === "policy" && (
        <div style={styles.section}>
          <PolicyTab />
        </div>
      )}

      {activeTab === "threats" && (
        <div style={styles.section}>
          <ThreatTab />
        </div>
      )}

      {activeTab === "reports" && (
        <div style={styles.section}>
          <ReportTab />
        </div>
      )}

      {activeTab === "risks" && (
        <div style={styles.section}>
          <RiskPriorityTab />
        </div>
      )}

      {activeTab === "integrations" && (
        <div style={styles.section}>
          <IntegrationsTab />
        </div>
      )}
      </div>
    </div>
  );
}

export function DashboardApp() {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <DashboardContent />
    </ThemeContext.Provider>
  );
}
