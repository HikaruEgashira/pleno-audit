import type { EventLog, CapturedAIPrompt } from "@pleno-audit/detectors";
import { AIPromptList } from "./AIPromptList";
import { EventLogList } from "./EventLog";
import { usePopupStyles } from "../styles";

interface SessionsTabProps {
  events: EventLog[];
  aiPrompts: CapturedAIPrompt[];
}

const SESSION_EVENT_TYPES = [
  "cookie_set",
  "login_detected",
  "privacy_policy_found",
  "terms_of_service_found",
  "nrd_detected",
  "typosquat_detected",
  "ai_prompt_sent",
  "ai_response_received",
];

export function SessionsTab({ events, aiPrompts }: SessionsTabProps) {
  const styles = usePopupStyles();

  const hasAIPrompts = aiPrompts.length > 0;
  const hasEvents = events.length > 0;

  if (!hasAIPrompts && !hasEvents) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>アクティビティはまだありません</p>
      </div>
    );
  }

  return (
    <div>
      {hasAIPrompts && (
        <div style={styles.divider}>
          <AIPromptList prompts={aiPrompts} />
        </div>
      )}

      {hasEvents && (
        <div style={styles.divider}>
          <EventLogList
            events={events}
            filterTypes={SESSION_EVENT_TYPES}
            title="アクティビティ"
          />
        </div>
      )}
    </div>
  );
}
