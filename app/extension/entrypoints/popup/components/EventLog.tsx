import type { EventLog } from "@service-policy-auditor/detectors";
import { styles } from "../styles";

interface Props {
  events: EventLog[];
}

export function EventLogList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No events yet</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Events ({events.length})</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Time</th>
            <th style={styles.tableHeader}>Domain</th>
            <th style={styles.tableHeader}>Type</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 50).map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </tbody>
      </table>
      {events.length > 50 && (
        <p style={{ color: "hsl(0 0% 60%)", fontSize: "11px", marginTop: "8px" }}>
          Showing 50 of {events.length} events
        </p>
      )}
    </div>
  );
}

function EventRow({ event }: { event: EventLog }) {
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  function getLabel(): string {
    switch (event.type) {
      case "cookie_set":
        return event.details.name;
      case "login_detected":
        return "login";
      case "privacy_policy_found":
        return "privacy";
      case "terms_of_service_found":
        return "tos";
      default:
        return event.type;
    }
  }

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <span style={{ fontFamily: styles.fontMono, fontSize: "11px" }}>{time}</span>
      </td>
      <td style={styles.tableCell}>
        <span style={styles.code}>{event.domain}</span>
      </td>
      <td style={styles.tableCell}>
        <span style={styles.badge}>{getLabel()}</span>
      </td>
    </tr>
  );
}
