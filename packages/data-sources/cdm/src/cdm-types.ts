/**
 * @fileoverview CDM (Continuous Diagnostics and Mitigation) Types
 *
 * Types for device and endpoint monitoring.
 */

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
