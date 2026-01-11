import type { EventLog } from "@pleno-audit/detectors";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface Props {
  events: EventLog[];
  filterTypes?: string[];
  title?: string;
}

export function EventLogList({ events, filterTypes, title = "イベント" }: Props) {
  const styles = usePopupStyles();
  const { colors } = useTheme();

  const filteredEvents = filterTypes
    ? events.filter((event) => filterTypes.includes(event.type))
    : events;

  if (filteredEvents.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>イベントはまだありません</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title} ({filteredEvents.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>時間</th>
              <th style={styles.tableHeader}>ドメイン</th>
              <th style={styles.tableHeader}>タイプ</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.slice(0, 50).map((event) => (
              <EventRow key={event.id} event={event} styles={styles} colors={colors} />
            ))}
          </tbody>
        </table>
      </div>
      {filteredEvents.length > 50 && (
        <p style={{ color: colors.textMuted, fontSize: "11px", marginTop: "8px" }}>
          50件中{filteredEvents.length}件を表示
        </p>
      )}
    </div>
  );
}

function EventRow({ event, styles, colors }: { event: EventLog; styles: ReturnType<typeof usePopupStyles>; colors: any }) {
  const time = new Date(event.timestamp).toLocaleTimeString("ja-JP", {
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
        return event.details.isNRD ? "NRD" : "verified";
      default:
        return event.type;
    }
  }

  function getBadgeVariant(): "default" | "danger" | "warning" | "success" {
    if (event.type === "nrd_detected" && event.details.isNRD) {
      return "danger";
    }
    if (event.type === "login_detected") {
      return "warning";
    }
    return "default";
  }

  function getTitle(): string {
    if (event.type === "nrd_detected") {
      if (event.details.isNRD) {
        const age = event.details.domainAge !== null ? ` (${event.details.domainAge}日)` : "";
        return `新規登録ドメイン${age} - ${event.details.method}`;
      } else {
        return `確認済みドメイン - ${event.details.method}`;
      }
    }
    return "";
  }

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: colors.textSecondary }}>{time}</span>
      </td>
      <td style={styles.tableCell}>
        <code style={styles.code}>{event.domain}</code>
      </td>
      <td style={styles.tableCell}>
        <span title={getTitle()}>
          <Badge variant={getBadgeVariant()}>{getLabel()}</Badge>
        </span>
      </td>
    </tr>
  );
}
