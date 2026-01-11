/**
 * Extension Storage Schema
 */
import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
  AIMonitorConfig,
  NRDConfig,
} from "@pleno-audit/detectors";
import type { CSPConfig, CSPReport } from "@pleno-audit/csp";

export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports?: CSPReport[];
  cspConfig?: CSPConfig;
  aiPrompts?: CapturedAIPrompt[];
  aiMonitorConfig?: AIMonitorConfig;
  nrdConfig?: NRDConfig;
}

export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
  NRDConfig,
};
