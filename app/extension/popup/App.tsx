import { useState, useEffect } from "preact/hooks";
import type { StorageData, DetectedService, EventLog } from "@ai-service-exposure/core";
import { ServiceList } from "./components/ServiceList";
import { EventLogList } from "./components/EventLog";

type Tab = "services" | "events";

export function App() {
  const [data, setData] = useState<StorageData>({ services: {}, events: [] });
  const [tab, setTab] = useState<Tab>("services");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.services || changes.events) {
        loadData();
      }
    });
  }, []);

  async function loadData() {
    const result = await chrome.storage.local.get(["services", "events"]);
    setData({
      services: result.services || {},
      events: result.events || [],
    });
    setLoading(false);
  }

  const services = Object.values(data.services) as DetectedService[];
  const events = data.events as EventLog[];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>AI Service Exposure</h1>
        <p style={styles.subtitle}>
          {services.length} services detected
        </p>
      </header>

      <nav style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(tab === "services" ? styles.tabActive : {}),
          }}
          onClick={() => setTab("services")}
        >
          Services
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
      </nav>

      <main style={styles.content}>
        {loading ? (
          <p style={styles.loading}>Loading...</p>
        ) : tab === "services" ? (
          <ServiceList services={services} />
        ) : (
          <EventLogList events={events} />
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  header: {
    padding: "16px",
    background: "#4a90d9",
    color: "white",
  },
  title: {
    fontSize: "18px",
    fontWeight: 600,
  },
  subtitle: {
    fontSize: "12px",
    opacity: 0.9,
    marginTop: "4px",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #ddd",
    background: "white",
  },
  tab: {
    flex: 1,
    padding: "12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "14px",
    color: "#666",
  },
  tabActive: {
    color: "#4a90d9",
    borderBottom: "2px solid #4a90d9",
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "8px",
  },
  loading: {
    textAlign: "center",
    padding: "20px",
    color: "#999",
  },
};
