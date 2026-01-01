import type { EventLog } from "@ai-service-exposure/core";

interface Props {
  events: EventLog[];
}

const EVENT_LABELS: Record<EventLog["type"], string> = {
  login_detected: "Login",
  privacy_policy_found: "Privacy",
  cookie_set: "Cookie",
};

export function EventLogList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyTitle}>No events recorded</p>
        <p style={styles.emptyHint}>Events will appear as you browse.</p>
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
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={styles.item}>
      <div style={styles.itemLeft}>
        <span style={styles.badge}>{EVENT_LABELS[event.type]}</span>
        <span style={styles.domain}>{event.domain}</span>
      </div>
      <div style={styles.itemRight}>
        {event.type === "cookie_set" && event.details.name && (
          <code style={styles.detail}>{String(event.details.name)}</code>
        )}
        <span style={styles.time}>{time}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  empty: {
    textAlign: "center",
    padding: "48px 20px",
  },
  emptyTitle: {
    fontSize: "14px",
    fontWeight: 500,
    color: "hsl(0 0% 9%)",
  },
  emptyHint: {
    fontSize: "13px",
    marginTop: "4px",
    color: "hsl(0 0% 45%)",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: "6px",
    background: "hsl(0 0% 98%)",
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  itemRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  badge: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: 500,
    background: "hsl(0 0% 100%)",
    color: "hsl(0 0% 45%)",
    border: "1px solid hsl(0 0% 88%)",
    flexShrink: 0,
  },
  domain: {
    fontSize: "13px",
    color: "hsl(0 0% 20%)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  detail: {
    fontSize: "11px",
    color: "hsl(0 0% 45%)",
    fontFamily: "ui-monospace, monospace",
    maxWidth: "100px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  time: {
    fontSize: "11px",
    color: "hsl(0 0% 55%)",
    fontVariantNumeric: "tabular-nums",
  },
};
