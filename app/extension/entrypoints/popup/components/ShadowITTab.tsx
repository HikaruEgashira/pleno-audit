import { ServiceList } from "./ServiceList";
import { AIPromptList } from "./AIPromptList";
import { EventLogList } from "./EventLog";
import { usePopupStyles } from "../styles";
import type { ShadowITTabProps } from "../types";

const SHADOW_IT_EVENT_TYPES = [
  "cookie_set",
  "login_detected",
  "privacy_policy_found",
  "terms_of_service_found",
];

export function ShadowITTab({ services, aiPrompts, events }: ShadowITTabProps) {
  const styles = usePopupStyles();

  return (
    <div>
      <ServiceList services={services} />

      {aiPrompts.length > 0 && (
        <div style={styles.divider}>
          <AIPromptList prompts={aiPrompts} />
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
