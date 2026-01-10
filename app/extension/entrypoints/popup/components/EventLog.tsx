import type { EventLog } from "@service-policy-auditor/detectors";
import { styles } from "../styles";

interface Props {
  events: EventLog[];
  filterTypes?: string[];
  title?: string;
}

export function EventLogList({ events, filterTypes, title = "Events" }: Props) {
  const filteredEvents = filterTypes
    ? events.filter((event) => filterTypes.includes(event.type))
    : events;

  if (filteredEvents.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No events yet</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title} ({filteredEvents.length})</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Time</th>
            <th style={styles.tableHeader}>Domain</th>
            <th style={styles.tableHeader}>Type</th>
          </tr>
        </thead>
        <tbody>
          {filteredEvents.slice(0, 50).map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </tbody>
      </table>
      {filteredEvents.length > 50 && (
        <p style={{ color: "hsl(0 0% 60%)", fontSize: "11px", marginTop: "8px" }}>
          Showing 50 of {filteredEvents.length} events
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
      case "nrd_detected":
        return event.details.isNRD ? "NRD" : "domain verified";
      default:
        return event.type;
    }
  }

  function getBadgeColor(): string {
    if (event.type === "nrd_detected" && event.details.isNRD) {
      return event.details.confidence === "high"
        ? "hsl(0 70% 60%)" // Red
        : "hsl(40 70% 50%)"; // Orange
    }
    return styles.badge.backgroundColor || "";
  }

  function getTitle(): string {
    if (event.type === "nrd_detected") {
      if (event.details.isNRD) {
        const age = event.details.domainAge !== null ? ` (${event.details.domainAge}d old)` : "";
        return `Newly Registered Domain${age} - ${event.details.method}`;
      } else {
        return `Domain verified - ${event.details.method}`;
      }
    }
    return "";
  }

  const badgeColor = getBadgeColor();
  const badgeStyle =
    badgeColor && event.type === "nrd_detected"
      ? { ...styles.badge, backgroundColor: badgeColor, color: "white", fontWeight: "bold" as const }
      : styles.badge;

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <span style={{ fontFamily: styles.fontMono, fontSize: "11px" }}>{time}</span>
      </td>
      <td style={styles.tableCell}>
        <span style={styles.code}>{event.domain}</span>
      </td>
      <td style={styles.tableCell}>
        <span
          style={badgeStyle}
          title={getTitle()}
        >
          {getLabel()}
        </span>
      </td>
    </tr>
  );
}
