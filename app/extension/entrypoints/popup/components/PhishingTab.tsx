import { DomainList } from "./DomainList";
import { EventLogList } from "./EventLog";
import { NRDSettings } from "./NRDSettings";
import { usePopupStyles } from "../styles";
import type { PhishingTabProps } from "../types";

export function PhishingTab({ services, events }: PhishingTabProps) {
  const styles = usePopupStyles();

  return (
    <div>
      <DomainList services={services} />

      {events.length > 0 && (
        <div style={styles.divider}>
          <EventLogList events={events} filterTypes={["nrd_detected", "typosquat_detected"]} title="アラート" />
        </div>
      )}

      <div style={styles.divider}>
        <NRDSettings />
      </div>
    </div>
  );
}
