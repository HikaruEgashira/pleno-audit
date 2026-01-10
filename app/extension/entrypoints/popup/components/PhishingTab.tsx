import type { DetectedService, EventLog } from "@service-policy-auditor/detectors";
import { NRDList } from "./NRDList";
import { EventLogList } from "./EventLog";
import { NRDSettings } from "./NRDSettings";
import { usePopupStyles } from "../styles";

interface Props {
  services: DetectedService[];
  events: EventLog[];
}

export function PhishingTab({ services, events }: Props) {
  const styles = usePopupStyles();

  return (
    <div>
      <NRDList services={services} />

      {events.length > 0 && (
        <div style={styles.divider}>
          <EventLogList events={events} filterTypes={["nrd_detected"]} title="アラート" />
        </div>
      )}

      <div style={styles.divider}>
        <NRDSettings />
      </div>
    </div>
  );
}
