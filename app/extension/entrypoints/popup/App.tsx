import { useState, useEffect } from "preact/hooks";
import type {
  StorageData,
  DetectedService,
  EventLog,
  CSPViolation,
  NetworkRequest,
} from "@ai-service-exposure/core";
import { ServiceList } from "./components/ServiceList";
import { EventLogList } from "./components/EventLog";
import { ViolationList } from "./components/ViolationList";
import { NetworkList } from "./components/NetworkList";
import { PolicyGenerator } from "./components/PolicyGenerator";
import { Settings } from "./components/Settings";

type Tab = "services" | "events" | "violations" | "network" | "policy" | "settings";

export function App() {
  const [data, setData] = useState<StorageData>({ services: {}, events: [] });
  const [tab, setTab] = useState<Tab>("services");
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<CSPViolation[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);

  useEffect(() => {
    loadData();
    loadCSPData();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
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

  const services = Object.values(data.services) as DetectedService[];
  const events = data.events as EventLog[];

  function renderContent() {
    if (loading) {
      return <p style={styles.loading}>Loading...</p>;
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
      <nav style={styles.nav}>
        <button
          style={{
            ...styles.tab,
            ...(tab === "services" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("services")}
        >
          Services
          {services.length > 0 && (
            <span style={styles.badge}>{services.length}</span>
          )}
        </button>
        <button
          style={{
            ...styles.tab,
            ...(tab === "events" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("events")}
        >
          Events
        </button>
        <button
          style={{
            ...styles.tab,
            ...(tab === "violations" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("violations")}
        >
          CSP
          {violations.length > 0 && (
            <span style={styles.badge}>{violations.length}</span>
          )}
        </button>
        <button
          style={{
            ...styles.tab,
            ...(tab === "network" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("network")}
        >
          Network
        </button>
        <button
          style={{
            ...styles.tab,
            ...(tab === "policy" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("policy")}
        >
          Policy
        </button>
        <button
          style={{
            ...styles.tab,
            ...(tab === "settings" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </nav>

      <main style={styles.content}>{renderContent()}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  nav: {
    display: "flex",
    padding: "8px 12px",
    gap: "4px",
    borderBottom: "1px solid hsl(0 0% 92%)",
    flexWrap: "wrap",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 10px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    color: "hsl(0 0% 45%)",
    transition: "all 0.15s",
  },
  tabActive: {
    color: "hsl(0 0% 10%)",
    background: "hsl(0 0% 95%)",
  },
  badge: {
    fontSize: "10px",
    color: "hsl(0 0% 50%)",
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
  loading: {
    textAlign: "center",
    padding: "60px 20px",
    color: "hsl(0 0% 50%)",
    fontSize: "13px",
  },
};
