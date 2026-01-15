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
import type { ForecastConfig } from "@pleno-audit/predictive-analysis";

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
  enableExtension: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enableNRD: false,
  enableTyposquat: true,
  enableAI: true,
  enablePrivacy: true,
  enableTos: true,
  enableLogin: true,
  enableExtension: true,
};

/**
 * ブロック設定（ユーザー同意ベース、デフォルト無効）
 */
export interface BlockingConfig {
  enabled: boolean; // 全体のブロック機能有効/無効
  blockTyposquat: boolean; // タイポスクワット検出時にブロック
  blockNRDLogin: boolean; // NRDでのログイン時に警告
  blockHighRiskExtension: boolean; // 高リスク拡張機能をブロック
  blockSensitiveDataToAI: boolean; // 機密データのAI送信をブロック
  userConsentGiven: boolean; // ユーザーが同意したか
  consentTimestamp: number; // 同意日時
}

export const DEFAULT_BLOCKING_CONFIG: BlockingConfig = {
  enabled: false, // デフォルト無効（ユーザー同意が必要）
  blockTyposquat: true,
  blockNRDLogin: true,
  blockHighRiskExtension: false,
  blockSensitiveDataToAI: false,
  userConsentGiven: false,
  consentTimestamp: 0,
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
  blockingConfig?: BlockingConfig;
  forecastConfig?: ForecastConfig;
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
  ForecastConfig,
};
