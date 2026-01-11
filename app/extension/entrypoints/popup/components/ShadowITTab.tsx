import { ServiceList } from "./ServiceList";
import { InputList } from "./InputList";
import { EventLogList } from "./EventLog";
import { usePopupStyles } from "../styles";
import type { ShadowITTabProps } from "../types";

const SHADOW_IT_EVENT_TYPES = [
  "cookie_set",
  "login_detected",
  "privacy_policy_found",
  "terms_of_service_found",
  "input_captured",
];

export function ShadowITTab({ services, inputs, events }: ShadowITTabProps) {
  const styles = usePopupStyles();

  return (
    <div>
      <ServiceList services={services} />

      {inputs.length > 0 && (
        <div style={styles.divider}>
          <InputList inputs={inputs} />
        </div>
      )}

      {events.length > 0 && (
        <div style={styles.divider}>
          <EventLogList events={events} filterTypes={SHADOW_IT_EVENT_TYPES} title="アクティビティ" />
        </div>
      )}
    </div>
  );
}
