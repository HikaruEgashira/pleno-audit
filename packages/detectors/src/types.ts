export interface DOMAdapter {
  querySelector(selector: string): Element | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T>;
  getLocation(): { origin: string; pathname: string; href: string };
}

export type DetectionMethod =
  | "url_pattern"
  | "link_text"
  | "link_rel"
  | "json_ld"
  | "og_meta"
  | "not_found";

export interface DetectionResult {
  found: boolean;
  url: string | null;
  method: DetectionMethod;
}

export interface PrivacyPolicyResult extends DetectionResult {}

export interface TosResult extends DetectionResult {}

export interface LoginDetectionResult {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}
