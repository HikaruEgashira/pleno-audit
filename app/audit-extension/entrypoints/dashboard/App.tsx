import { useEffect, useState } from "preact/hooks";
import { Shield } from "lucide-preact";
import {
  ThemeContext,
  useThemeState,
  useTheme,
  spacing,
} from "../../lib/theme";
import {
  Badge,
  Button,
  Select,
  SettingsMenu,
  StatCard,
  Sidebar,
  StatsGrid,
  NotificationBanner,
} from "../../components";
import { SkeletonDashboard } from "../../components/Skeleton";
import { ExtensionsTab } from "./views/ExtensionsTab";
import { OverviewTab } from "./views/OverviewTab";
import { ViolationsTab } from "./views/ViolationsTab";
import { NetworkTab } from "./views/NetworkTab";
import { DomainsTab } from "./views/DomainsTab";
import { AiTab } from "./views/AiTab";
import { ServicesTab } from "./views/ServicesTab";
import { EventsTab } from "./views/EventsTab";
import {
  dashboardTabOrder,
  dashboardTabs,
  overviewTabs,
  periodOptions,
} from "./dashboard-constants";
import { createDashboardStyles } from "./dashboard-utils";
import { useDashboardData, useDashboardFilters } from "./dashboard-hooks";
import type { Period, TabType } from "./dashboard-types";

function getInitialTab(): TabType {
  const hash = window.location.hash.slice(1);
  const validTabs = dashboardTabs.map((tab) => tab.id);
  if (hash === "permissions") return "extensions";
  return validTabs.includes(hash as TabType)
    ? (hash as TabType)
    : "overview";
}

function DashboardContent() {
  const { colors, isDark } = useTheme();
  const styles = createDashboardStyles(colors, isDark);

  const [period, setPeriod] = useState<Period>("24h");
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [directiveFilter, setDirectiveFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validTabs = dashboardTabs.map((tab) => tab.id);
      if (hash === "permissions") {
        setActiveTab("extensions");
      } else if (validTabs.includes(hash as TabType)) {
        setActiveTab(hash as TabType);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const {
    violations,
    networkRequests,
    directives,
    directiveStats,
    domainStats,
    totalCounts,
    lastUpdated,
    loading,
    connectionMode,
    aiPrompts,
    services,
    events,
    isRefreshing,
    notifications,
    addNotification,
    dismissNotification,
    nrdServices,
    loginServices,
    status,
    loadData,
  } = useDashboardData({ period, setActiveTab });

  const {
    filteredViolations,
    filteredNetworkRequests,
    filteredAIPrompts,
    filteredServices,
    filteredEvents,
  } = useDashboardFilters({
    violations,
    networkRequests,
    aiPrompts,
    services,
    events,
    searchQuery,
    directiveFilter,
    typeFilter,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (dashboardTabOrder[idx]) setActiveTab(dashboardTabOrder[idx]);
      }
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        loadData();
      }
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
    } catch (err) {
      console.error("Failed to clear data:", err);
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ reports: [...violations, ...networkRequests], services, events, aiPrompts }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <Sidebar
          tabs={overviewTabs}
          activeTab="overview"
          onChange={() => {}}
        />
        <div style={styles.container}>
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <NotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
      />
      <Sidebar
        tabs={dashboardTabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabType)}
      />
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <h1 style={styles.title}>
                <Shield size={20} />
                Pleno Audit
                <Badge variant={status.variant} size="md" dot={status.dot}>
                  {status.label}
                </Badge>
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
              <SettingsMenu
                onClearData={handleClearData}
                onExport={handleExportJSON}
              />
            </div>
          </div>

          <div style={{ marginBottom: spacing.xl }}>
            <StatsGrid minWidth="lg">
              <StatCard
                value={totalCounts.violations}
                label="CSP違反"
                onClick={() => setActiveTab("violations")}
              />
              <StatCard
                value={nrdServices.length}
                label="NRD検出"
                trend={
                  nrdServices.length > 0
                    ? { value: nrdServices.length, isUp: true }
                    : undefined
                }
                onClick={() => {
                  setActiveTab("services");
                  setSearchQuery("nrd");
                }}
              />
              <StatCard
                value={totalCounts.aiPrompts}
                label="AIプロンプト"
                onClick={() => setActiveTab("ai")}
              />
              <StatCard
                value={services.length}
                label="サービス"
                onClick={() => setActiveTab("services")}
              />
              <StatCard
                value={loginServices.length}
                label="ログイン検出"
                onClick={() => {
                  setActiveTab("services");
                  setSearchQuery("login");
                }}
              />
              <StatCard
                value={totalCounts.events}
                label="イベント"
                onClick={() => setActiveTab("events")}
              />
            </StatsGrid>
          </div>
        </header>

        {activeTab === "overview" && (
          <OverviewTab
            styles={styles}
            colors={colors}
            isDark={isDark}
            events={events}
            nrdServices={nrdServices}
            services={services}
            violations={violations}
            aiPrompts={aiPrompts}
            directiveStats={directiveStats}
            domainStats={domainStats}
          />
        )}

        {activeTab === "violations" && (
          <ViolationsTab
            styles={styles}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            directiveFilter={directiveFilter}
            onDirectiveFilterChange={setDirectiveFilter}
            directives={directives}
            filteredViolations={filteredViolations}
          />
        )}

        {activeTab === "network" && (
          <NetworkTab
            styles={styles}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filteredNetworkRequests={filteredNetworkRequests}
          />
        )}

        {activeTab === "domains" && (
          <DomainsTab
            styles={styles}
            domainStats={domainStats}
            violations={violations}
            networkRequests={networkRequests}
            onNotify={addNotification}
          />
        )}

        {activeTab === "ai" && (
          <AiTab
            styles={styles}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filteredAIPrompts={filteredAIPrompts}
          />
        )}

        {activeTab === "services" && (
          <ServicesTab
            styles={styles}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filteredServices={filteredServices}
            nrdCount={nrdServices.length}
            loginCount={loginServices.length}
          />
        )}

        {activeTab === "events" && (
          <EventsTab
            styles={styles}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            filteredEvents={filteredEvents}
          />
        )}

        {activeTab === "extensions" && (
          <div style={styles.section}>
            <ExtensionsTab colors={colors} />
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
