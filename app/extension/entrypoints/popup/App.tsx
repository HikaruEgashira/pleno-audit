import { useState, useEffect } from "preact/hooks";
import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
} from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { StorageData } from "@pleno-audit/extension-runtime";
import { Shield } from "lucide-preact";
import { ThemeContext, useThemeState, useTheme } from "../../lib/theme";
import { Badge, Button, SettingsMenu } from "../../components";
import { ServicesTab } from "./components/ServicesTab";
import { SessionsTab } from "./components/SessionsTab";
import { RequestsTab } from "./components/RequestsTab";
import { createStyles } from "./styles";
import { aggregateServices, type UnifiedService } from "./utils/serviceAggregator";

type Tab = "services" | "sessions" | "requests";

const TABS: { key: Tab; label: string; count?: (data: TabData) => number }[] = [
  { key: "services", label: "Services", count: (d) => d.unifiedServices.length },
  { key: "sessions", label: "Sessions", count: (d) => d.events.length + d.aiPrompts.length },
  { key: "requests", label: "Requests", count: (d) => d.violations.length + d.networkRequests.length },
];

interface TabData {
  services: DetectedService[];
  unifiedServices: UnifiedService[];
  aiPrompts: CapturedAIPrompt[];
  events: EventLog[];
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
}

interface EventQueryResult {
  events: EventLog[];
  total: number;
  hasMore: boolean;
}

function getStatus(data: TabData) {
  const nrdCount = data.services.filter(s => s.nrdResult?.isNRD).length;
  if (nrdCount > 0) return { variant: "danger" as const, label: "警告", dot: false };
  if (data.violations.length > 10) return { variant: "warning" as const, label: "注意", dot: false };
  if (data.aiPrompts.length > 0) return { variant: "info" as const, label: "監視", dot: false };
  return { variant: "success" as const, label: "正常", dot: true };
}

function PopupContent() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [data, setData] = useState<StorageData>({ services: {}, events: [] });
  const [tab, setTab] = useState<Tab>("services");
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<CSPViolation[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [unifiedServices, setUnifiedServices] = useState<UnifiedService[]>([]);

  useEffect(() => {
    loadData();
    loadCSPData();
    loadAIData();
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.services) {
        loadData();
      }
      if (changes.cspReports) {
        loadCSPData();
      }
      if (changes.aiPrompts) {
        loadAIData();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadData() {
    try {
      const [servicesResult, eventsResult] = await Promise.all([
        chrome.storage.local.get(["services"]),
        chrome.runtime.sendMessage({ type: "GET_EVENTS", data: {} }),
      ]);

      const events = (eventsResult as EventQueryResult | undefined)?.events || [];
      setData({
        services: servicesResult.services || {},
        events,
      });
    } catch {
      setData({
        services: {},
        events: [],
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadCSPData() {
    try {
      const [vData, nData] = await Promise.all([
        chrome.runtime.sendMessage({
          type: "GET_CSP_REPORTS",
          data: { type: "csp-violation" },
        }),
        chrome.runtime.sendMessage({
          type: "GET_CSP_REPORTS",
          data: { type: "network-request" },
        }),
      ]);
      if (Array.isArray(vData)) setViolations(vData);
      if (Array.isArray(nData)) setNetworkRequests(nData);
    } catch {
      // Failed to load CSP data
    }
  }

  async function loadAIData() {
    try {
      const data = await chrome.runtime.sendMessage({ type: "GET_AI_PROMPTS" });
      if (Array.isArray(data)) setAIPrompts(data);
    } catch {
      // Failed to load AI data
    }
  }

  async function handleClearData() {
    if (!confirm("すべてのデータを削除しますか？")) return;
    try {
      await chrome.storage.local.remove(["services"]);
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await chrome.runtime.sendMessage({ type: "CLEAR_AI_DATA" });
      await chrome.runtime.sendMessage({ type: "CLEAR_EVENTS" });
      setData({ services: {}, events: [] });
      setViolations([]);
      setNetworkRequests([]);
      setAIPrompts([]);
      setUnifiedServices([]);
    } catch {
      // Failed to clear data
    }
  }

  // Update unified services when dependencies change
  useEffect(() => {
    const services = Object.values(data.services) as DetectedService[];
    aggregateServices(services, networkRequests, violations)
      .then(setUnifiedServices)
      .catch(() => {});
  }, [data.services, networkRequests, violations]);

  function openDashboard() {
    const url = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url });
  }

  const services = Object.values(data.services) as DetectedService[];
  const events = data.events;

  const tabData: TabData = { services, unifiedServices, aiPrompts, events, violations, networkRequests };
  const status = getStatus(tabData);

  function renderContent() {
    if (loading) {
      return <p style={styles.emptyText}>読み込み中...</p>;
    }
    switch (tab) {
      case "services":
        return (
          <ServicesTab
            services={services}
            violations={violations}
            networkRequests={networkRequests}
          />
        );
      case "sessions":
        return <SessionsTab events={events} aiPrompts={aiPrompts} />;
      case "requests":
        return <RequestsTab violations={violations} networkRequests={networkRequests} />;
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          <Shield size={20} />
          Pleno Audit
          <Badge variant={status.variant} size="sm" dot={status.dot}>{status.label}</Badge>
        </h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button variant="secondary" size="sm" onClick={openDashboard}>
            Dashboard
          </Button>
          <SettingsMenu onClearData={handleClearData} />
        </div>
      </header>

      <nav style={styles.tabNav}>
        {TABS.map((t) => {
          const count = t.count?.(tabData) || 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tabBtn,
                ...(tab === t.key ? styles.tabBtnActive : styles.tabBtnInactive),
              }}
            >
              {t.label}
              {count > 0 && (
                <span style={{
                  ...styles.tabCount,
                  ...(tab === t.key ? styles.tabCountActive : styles.tabCountInactive),
                }}>
                  {count > 50 ? "50+" : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main style={styles.content}>{renderContent()}</main>
    </div>
  );
}

export function App() {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <PopupContent />
    </ThemeContext.Provider>
  );
}
