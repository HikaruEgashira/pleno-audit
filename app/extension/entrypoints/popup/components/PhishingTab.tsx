import type { DetectedService, EventLog } from "@service-policy-auditor/detectors";
import { NRDList } from "./NRDList";
import { EventLogList } from "./EventLog";
import { NRDSettings } from "./NRDSettings";
import { styles } from "../styles";

interface Props {
  services: DetectedService[];
  events: EventLog[];
}

export function PhishingTab({ services, events }: Props) {
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
