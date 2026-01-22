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

/**
 * 通知設定（デフォルト無効）
 */
export interface NotificationConfig {
  enabled: boolean; // 通知全体の有効/無効
  severityFilter: ("critical" | "high" | "medium" | "low" | "info")[]; // 通知する重大度
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: false, // デフォルト無効
  severityFilter: ["critical", "high"],
};

/**
 * アラートクールダウン永続化用
 * キー: アラートの種類とドメイン/IDの組み合わせ
 * 値: 最後のアラート発火時刻
 */
export interface AlertCooldownData {
  [key: string]: number;
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
  /** 検出方法: webRequest または declarativeNetRequest */
  detectedBy?: "webRequest" | "declarativeNetRequest";
}

export type DoHDetectionMethod =
  | "content-type"
  | "accept-header"
  | "url-path"
  | "dns-param";

export type DoHAction = "detect" | "alert" | "block";

export interface DoHMonitorConfig {
  action: DoHAction;
  maxStoredRequests: number;
}

export interface DoHRequestRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  method: string;
  detectionMethod: DoHDetectionMethod;
  initiator?: string;
  blocked: boolean;
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
  doHRequests?: DoHRequestRecord[];
  doHMonitorConfig?: DoHMonitorConfig;
  dataRetentionConfig?: DataRetentionConfig;
  detectionConfig?: DetectionConfig;
  blockingConfig?: BlockingConfig;
  forecastConfig?: ForecastConfig;
  notificationConfig?: NotificationConfig;
  alertCooldown?: AlertCooldownData;
}

export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
  NRDConfig,
  DoHAction,
  DoHDetectionMethod,
  DoHMonitorConfig,
  DoHRequestRecord,
  DataRetentionConfig,
  DetectionConfig,
  ForecastConfig,
  NotificationConfig,
  AlertCooldownData,
};
