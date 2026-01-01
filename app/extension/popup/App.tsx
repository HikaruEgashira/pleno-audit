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
        <h1 style={styles.title}>Service Exposure</h1>
        <p style={styles.subtitle}>
          {services.length} service{services.length !== 1 ? "s" : ""} detected
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
    padding: "16px 20px",
    borderBottom: "1px solid hsl(0 0% 90%)",
  },
  title: {
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "hsl(0 0% 9%)",
  },
  subtitle: {
    fontSize: "13px",
    color: "hsl(0 0% 45%)",
    marginTop: "2px",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid hsl(0 0% 90%)",
    padding: "0 12px",
    gap: "4px",
  },
  tab: {
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    color: "hsl(0 0% 45%)",
    borderBottom: "2px solid transparent",
    marginBottom: "-1px",
    transition: "color 0.15s",
  },
  tabActive: {
    color: "hsl(0 0% 9%)",
    borderBottomColor: "hsl(0 0% 9%)",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "12px",
  },
  loading: {
    textAlign: "center",
    padding: "40px 20px",
    color: "hsl(0 0% 45%)",
    fontSize: "13px",
  },
};
