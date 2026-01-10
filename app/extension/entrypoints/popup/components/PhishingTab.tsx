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
        <div style={{ borderTop: "1px solid hsl(0 0% 80%)", marginTop: "16px", paddingTop: "16px" }}>
          <EventLogList events={events} filterTypes={["nrd_detected"]} />
        </div>
      )}

      <div style={{ borderTop: "1px solid hsl(0 0% 80%)", marginTop: "16px", paddingTop: "16px" }}>
        <NRDSettings />
      </div>
    </div>
  );
}
