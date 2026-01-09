import { useState, useEffect } from "preact/hooks";
import type {
  StorageData,
  DetectedService,
  EventLog,
  CSPViolation,
  NetworkRequest,
} from "@service-policy-controller/core";
import { ServiceList } from "./components/ServiceList";
import { EventLogList } from "./components/EventLog";
import { ViolationList } from "./components/ViolationList";
import { NetworkList } from "./components/NetworkList";
import { PolicyGenerator } from "./components/PolicyGenerator";
import { Settings } from "./components/Settings";
import { styles } from "./styles";

type Tab =
  | "services"
  | "events"
  | "violations"
  | "network"
  | "policy"
  | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "services", label: "Services" },
  { key: "events", label: "Events" },
  { key: "violations", label: "Violations" },
  { key: "network", label: "Network" },
  { key: "policy", label: "Policy" },
  { key: "settings", label: "Settings" },
];

export function App() {
  const [data, setData] = useState<StorageData>({ services: {}, events: [] });
  const [tab, setTab] = useState<Tab>("services");
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<CSPViolation[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);

  useEffect(() => {
    loadData();
    loadCSPData();
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.services || changes.events) {
        loadData();
      }
      if (changes.cspReports) {
        loadCSPData();
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

  async function handleClearData() {
    if (!confirm("Clear all collected data?")) return;
    try {
      await chrome.storage.local.remove(["services", "events"]);
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      setData({ services: {}, events: [] });
      setViolations([]);
      setNetworkRequests([]);
    } catch (err) {
      console.error("Failed to clear data:", err);
    }
  }

  const services = Object.values(data.services) as DetectedService[];
  const events = data.events as EventLog[];

  function renderContent() {
    if (loading) {
      return <p style={styles.emptyText}>Loading...</p>;
    }
    switch (tab) {
      case "services":
        return <ServiceList services={services} />;
      case "events":
        return <EventLogList events={events} />;
      case "violations":
        return <ViolationList violations={violations} />;
      case "network":
        return <NetworkList requests={networkRequests} />;
      case "policy":
        return <PolicyGenerator />;
      case "settings":
        return <Settings />;
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Service Policy Controller</h1>
        <button
          onClick={handleClearData}
          style={styles.clearBtn}
          title="Clear all data"
        >
          Clear
        </button>
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
