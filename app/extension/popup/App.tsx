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
  nav: {
    display: "flex",
    padding: "12px 16px",
    gap: "8px",
    borderBottom: "1px solid hsl(0 0% 92%)",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    color: "hsl(0 0% 45%)",
    transition: "all 0.15s",
  },
  tabActive: {
    color: "hsl(0 0% 10%)",
    background: "hsl(0 0% 95%)",
  },
  badge: {
    fontSize: "11px",
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
