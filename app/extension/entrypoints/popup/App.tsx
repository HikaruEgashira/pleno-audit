import { useState, useEffect } from "preact/hooks";
import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
} from "@service-policy-auditor/detectors";
import type { CSPViolation, NetworkRequest } from "@service-policy-auditor/csp";
import type { StorageData } from "@service-policy-auditor/extension-runtime";
import { ThemeContext, useThemeState, useTheme } from "../../lib/theme";
import { Badge, Button, SettingsMenu } from "../../components";
import { ShadowITTab } from "./components/ShadowITTab";
import { PhishingTab } from "./components/PhishingTab";
import { MalwareTab } from "./components/MalwareTab";
import { createStyles } from "./styles";

type Tab = "sessions" | "domains" | "requests";

const TABS: { key: Tab; label: string; count?: (data: TabData) => number }[] = [
  { key: "sessions", label: "Sessions", count: (d) => d.services.length + d.aiPrompts.length },
  { key: "domains", label: "Domains", count: (d) => d.services.filter(s => s.nrdResult?.isNRD).length },
  { key: "requests", label: "Requests", count: (d) => d.violations.length },
];

interface TabData {
  services: DetectedService[];
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
  const [tab, setTab] = useState<Tab>("sessions");
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<CSPViolation[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);

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
        chrome.runtime.sendMessage({ type: "GET_EVENTS", data: { limit: 10000, offset: 0 } }),
      ]);

      const events = (eventsResult as EventQueryResult | undefined)?.events || [];
      setData({
        services: servicesResult.services || {},
        events,
      });
    } catch (error) {
      console.error("Failed to load data:", error);
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
    } catch (error) {
      console.error("Failed to load CSP data:", error);
    }
  }

  async function loadAIData() {
    try {
      const data = await chrome.runtime.sendMessage({ type: "GET_AI_PROMPTS" });
      if (Array.isArray(data)) setAIPrompts(data);
    } catch (error) {
      console.error("Failed to load AI data:", error);
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
    } catch (err) {
      console.error("Failed to clear data:", err);
    }
  }

  function openDashboard() {
    const url = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url });
  }

  const services = Object.values(data.services) as DetectedService[];
  const events = data.events as EventLog[];

  const tabData: TabData = { services, aiPrompts, events, violations, networkRequests };
  const status = getStatus(tabData);

  function renderContent() {
    if (loading) {
      return <p style={styles.emptyText}>読み込み中...</p>;
    }
    switch (tab) {
      case "sessions":
        return <ShadowITTab services={services} aiPrompts={aiPrompts} events={events} />;
      case "domains":
        return <PhishingTab services={services} events={events} />;
      case "requests":
        return <MalwareTab violations={violations} networkRequests={networkRequests} />;
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>
          Auditor
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
                  {count}
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
