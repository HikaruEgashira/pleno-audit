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

export interface DataRetentionConfig {
  retentionDays: number;
  autoCleanupEnabled: boolean;
  lastCleanupTimestamp: number;
}

export const DEFAULT_DATA_RETENTION_CONFIG: DataRetentionConfig = {
  retentionDays: 180, // 6ヶ月
  autoCleanupEnabled: true,
  lastCleanupTimestamp: 0,
};

export interface DetectionConfig {
  enableNRD: boolean;
  enableTyposquat: boolean;
  enableAI: boolean;
  enablePrivacy: boolean;
  enableTos: boolean;
  enableLogin: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enableNRD: false,
  enableTyposquat: true,
  enableAI: true,
  enablePrivacy: true,
  enableTos: true,
  enableLogin: true,
};

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
  dataRetentionConfig?: DataRetentionConfig;
  detectionConfig?: DetectionConfig;
}

export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
  NRDConfig,
  DataRetentionConfig,
  DetectionConfig,
};
