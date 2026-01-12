import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
} from "@pleno-audit/detectors";

export interface ViolationProps {
  violations: CSPViolation[];
}

export interface ServiceProps {
  services: DetectedService[];
}

export interface EventProps {
  events: EventLog[];
}

export interface ServicesTabProps extends ServiceProps, ViolationProps {
  networkRequests: NetworkRequest[];
}

export interface SessionsTabProps extends EventProps {
  aiPrompts: CapturedAIPrompt[];
}

export interface RequestsTabProps extends ViolationProps {
  networkRequests: NetworkRequest[];
}
