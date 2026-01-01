export interface DetectedService {
  domain: string;
  detectedAt: number;
  hasLoginPage: boolean;
  privacyPolicyUrl: string | null;
  cookies: CookieInfo[];
}

export interface CookieInfo {
  name: string;
  domain: string;
  detectedAt: number;
  isSession: boolean;
}

export interface LoginDetectedDetails {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}

export interface PrivacyPolicyFoundDetails {
  url: string;
  method: string;
}

export interface CookieSetDetails {
  name: string;
  isSession: boolean;
}

export type EventLogBase<T extends string, D> = {
  id: string;
  type: T;
  domain: string;
  timestamp: number;
  details: D;
};

export type EventLog =
  | EventLogBase<"login_detected", LoginDetectedDetails>
  | EventLogBase<"privacy_policy_found", PrivacyPolicyFoundDetails>
  | EventLogBase<"cookie_set", CookieSetDetails>;

export type EventLogType = EventLog["type"];

export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
}
