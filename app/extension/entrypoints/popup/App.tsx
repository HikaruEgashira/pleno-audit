import { useState, useEffect } from "preact/hooks";
import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
} from "@service-policy-auditor/detectors";
import type { CSPViolation, NetworkRequest } from "@service-policy-auditor/csp";
import type { StorageData } from "@service-policy-auditor/extension-runtime";
import { ShadowITTab } from "./components/ShadowITTab";
import { PhishingTab } from "./components/PhishingTab";
import { MalwareTab } from "./components/MalwareTab";
import { styles } from "./styles";

type Tab = "shadow-it" | "phishing" | "malware";

const TABS: { key: Tab; label: string }[] = [
  { key: "shadow-it", label: "Shadow IT" },
  { key: "phishing", label: "Phishing" },
  { key: "malware", label: "Malware" },
];

export function App() {
  const [data, setData] = useState<StorageData>({ services: {}, events: [] });
  const [tab, setTab] = useState<Tab>("shadow-it");
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
      if (changes.services || changes.events) {
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
    const result = await chrome.storage.local.get(["services", "events"]);
    setData({
      services: result.services || {},
      events: result.events || [],
    });
    setLoading(false);
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
    if (!confirm("Clear all collected data?")) return;
    try {
      await chrome.storage.local.remove(["services", "events"]);
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await chrome.runtime.sendMessage({ type: "CLEAR_AI_DATA" });
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

  function renderContent() {
    if (loading) {
      return <p style={styles.emptyText}>Loading...</p>;
    }
    switch (tab) {
      case "shadow-it":
        return <ShadowITTab services={services} aiPrompts={aiPrompts} events={events} />;
      case "phishing":
        return <PhishingTab services={services} events={events} />;
      case "malware":
        return <MalwareTab violations={violations} networkRequests={networkRequests} />;
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Service Policy Auditor</h1>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={openDashboard}
            style={styles.clearBtn}
            title="Open Dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={handleClearData}
            style={styles.clearBtn}
            title="Clear all data"
          >
            Clear
          </button>
        </div>
      </header>

      <nav style={styles.tabNav}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...styles.tabBtn,
              ...(tab === t.key ? styles.tabBtnActive : styles.tabBtnInactive),
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main style={styles.content}>{renderContent()}</main>
    </div>
  );
}
