/**
 * @fileoverview Enterprise Policy Admin Types
 */

export interface DetectionConfig {
  enableNRD: boolean;
  enableTyposquat: boolean;
  enableAI: boolean;
  enablePrivacy: boolean;
  enableTos: boolean;
  enableLogin: boolean;
  enableExtension: boolean;
}

export interface BlockingConfig {
  enabled: boolean;
  blockTyposquat: boolean;
  blockNRDLogin: boolean;
  blockHighRiskExtension: boolean;
  blockSensitiveDataToAI: boolean;
  userConsentGiven: boolean;
  consentTimestamp: number;
}

export interface NotificationConfig {
  enabled: boolean;
  severityFilter: ("critical" | "high" | "medium" | "low" | "info")[];
}

export interface EnterpriseSSOConfig {
  provider?: "oidc" | "saml";
  required?: boolean;
  clientId?: string;
  authority?: string;
  scope?: string;
  entityId?: string;
  entryPoint?: string;
  issuer?: string;
}

export interface EnterprisePolicyConfig {
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedAIProviders?: string[];
  blockedAIProviders?: string[];
}

export interface EnterpriseReportingConfig {
  endpoint?: string;
  apiKey?: string;
  enabled?: boolean;
  batchSize?: number;
  flushIntervalSeconds?: number;
}

export interface EnterpriseManagedConfig {
  sso?: EnterpriseSSOConfig;
  settings?: {
    locked?: boolean;
    enableNRD?: boolean;
    enableTyposquat?: boolean;
    enableAI?: boolean;
    enablePrivacy?: boolean;
    enableTos?: boolean;
    enableLogin?: boolean;
    enableExtension?: boolean;
    enableBlocking?: boolean;
    enableNotifications?: boolean;
  };
  reporting?: EnterpriseReportingConfig;
  policy?: EnterprisePolicyConfig;
}

export interface EnterpriseStatus {
  isManaged: boolean;
  ssoRequired: boolean;
  settingsLocked: boolean;
  config: EnterpriseManagedConfig | null;
}
