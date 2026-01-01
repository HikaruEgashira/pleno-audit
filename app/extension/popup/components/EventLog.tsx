import type { EventLog } from "@ai-service-exposure/core";

interface Props {
  events: EventLog[];
}

const EVENT_LABELS: Record<EventLog["type"], string> = {
  login_detected: "Login Page",
  privacy_policy_found: "Privacy Policy",
  cookie_set: "Cookie Set",
};

const EVENT_COLORS: Record<EventLog["type"], { bg: string; text: string }> = {
  login_detected: { bg: "#e3f2fd", text: "#1976d2" },
  privacy_policy_found: { bg: "#e8f5e9", text: "#388e3c" },
  cookie_set: { bg: "#fff3e0", text: "#f57c00" },
};

export function EventLogList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No events recorded yet.</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {events.slice(0, 50).map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventItem({ event }: { event: EventLog }) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const date = new Date(event.timestamp).toLocaleDateString();
  const colors = EVENT_COLORS[event.type];

  return (
    <div style={styles.item}>
      <div style={styles.itemHeader}>
        <span
          style={{
            ...styles.badge,
            background: colors.bg,
            color: colors.text,
          }}
        >
          {EVENT_LABELS[event.type]}
        </span>
        <span style={styles.time}>
          {date} {time}
        </span>
      </div>
      <div style={styles.domain}>{event.domain}</div>
      {event.type === "cookie_set" && event.details.name && (
        <div style={styles.detail}>
          Cookie: <code style={styles.code}>{String(event.details.name)}</code>
        </div>
      )}
      {event.type === "privacy_policy_found" && event.details.url && (
        <a
          href={String(event.details.url)}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          {String(event.details.url)}
        </a>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#666",
  },
  item: {
    background: "white",
    borderRadius: "6px",
    padding: "10px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  badge: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: 500,
  },
  time: {
    fontSize: "10px",
    color: "#999",
  },
  domain: {
    fontSize: "13px",
    fontWeight: 500,
  },
  detail: {
    fontSize: "11px",
    color: "#666",
    marginTop: "4px",
  },
  code: {
    background: "#f5f5f5",
    padding: "1px 4px",
    borderRadius: "2px",
    fontFamily: "monospace",
  },
  link: {
    fontSize: "11px",
    color: "#4a90d9",
    textDecoration: "none",
    display: "block",
    marginTop: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
