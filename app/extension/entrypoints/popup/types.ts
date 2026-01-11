import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DetectedService, EventLog } from "@pleno-audit/detectors";

export interface ViolationProps {
  violations: CSPViolation[];
}

export interface ServiceProps {
  services: DetectedService[];
}

export interface EventProps {
  events: EventLog[];
}

export interface PhishingTabProps extends ServiceProps, EventProps {}

export interface ShadowITTabProps extends ServiceProps, EventProps {}

export interface MalwareTabProps extends ViolationProps {
  networkRequests: NetworkRequest[];
}
