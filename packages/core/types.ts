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

export interface EventLog {
  id: string;
  type: "login_detected" | "privacy_policy_found" | "cookie_set";
  domain: string;
  timestamp: number;
  details: Record<string, unknown>;
}

export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
}
