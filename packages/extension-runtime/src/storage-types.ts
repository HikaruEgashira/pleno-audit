/**
 * Extension Storage Schema
 */
import type {
  DetectedService,
  EventLog,
  CapturedInput,
  CapturedAIPrompt,
  InputMonitorConfig,
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
  // 入力監視（新）
  inputs?: CapturedInput[];
  inputMonitorConfig?: InputMonitorConfig;
  // 後方互換（旧AI監視）
  aiPrompts?: CapturedAIPrompt[];
  aiMonitorConfig?: AIMonitorConfig;
  nrdConfig?: NRDConfig;
  extensionRequests?: ExtensionRequestRecord[];
  extensionMonitorConfig?: ExtensionMonitorConfig;
  dataRetentionConfig?: DataRetentionConfig;
}

export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedInput,
  CapturedAIPrompt,
  InputMonitorConfig,
  AIMonitorConfig,
  NRDConfig,
  DataRetentionConfig,
};
