import type { EventLog } from "@ai-service-exposure/core";

interface Props {
  events: EventLog[];
}

export function EventLogList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No events yet</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {events.slice(0, 50).map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventRow({ event }: { event: EventLog }) {
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  function getLabel(): string {
    switch (event.type) {
      case "cookie_set":
        return event.details.name;
      case "login_detected":
        return "login";
      case "privacy_policy_found":
        return "privacy";
    }
  }

  return (
    <div style={styles.row}>
      <span style={styles.time}>{time}</span>
      <span style={styles.domain}>{event.domain}</span>
      <span style={styles.label}>{getLabel()}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    padding: "8px 0",
    fontFamily: "ui-monospace, monospace",
    fontSize: "12px",
  },
  empty: {
    padding: "60px 20px",
    textAlign: "center",
    fontSize: "13px",
    color: "hsl(0 0% 50%)",
    fontFamily: "-apple-system, sans-serif",
  },
  row: {
    display: "flex",
    gap: "16px",
    padding: "8px 20px",
    color: "hsl(0 0% 40%)",
  },
  time: {
    color: "hsl(0 0% 60%)",
    flexShrink: 0,
    width: "45px",
  },
  domain: {
    color: "hsl(0 0% 25%)",
    flex: 1,
  },
  label: {
    color: "hsl(0 0% 55%)",
    textAlign: "right",
  },
};
