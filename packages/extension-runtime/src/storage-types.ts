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

export interface ExtensionMonitorConfig {
  enabled: boolean;
  excludeOwnExtension: boolean;
  excludedExtensions: string[];
  maxStoredRequests: number;
}

export interface ExtensionRequestRecord {
  id: string;
  extensionId: string;
  extensionName: string;
  timestamp: number;
  url: string;
  method: string;
  resourceType: string;
  domain: string;
  statusCode?: number;
}

export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports?: CSPReport[];
  cspConfig?: CSPConfig;
  aiPrompts?: CapturedAIPrompt[];
  aiMonitorConfig?: AIMonitorConfig;
  nrdConfig?: NRDConfig;
  extensionRequests?: ExtensionRequestRecord[];
  extensionMonitorConfig?: ExtensionMonitorConfig;
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
