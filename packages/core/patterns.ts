// Login page URL patterns
export const LOGIN_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/auth/i,
  /\/authenticate/i,
  /\/session\/new/i,
];

// Privacy policy URL patterns
export const PRIVACY_URL_PATTERNS = [
  /\/privacy[-_]?policy/i,
  /\/privacy/i,
  /\/legal\/privacy/i,
  /\/terms\/privacy/i,
  /\/about\/privacy/i,
  /\/privacypolicy/i,
  // German
  /\/datenschutz/i,
  // Japanese (decoded)
  /プライバシー/,
];

// Privacy policy link text patterns (multilingual)
export const PRIVACY_TEXT_PATTERNS = [
  /privacy\s*policy/i,
  /privacy\s*notice/i,
  /privacy/i,
  /プライバシー\s*ポリシー/,
  /プライバシー/,
  /個人情報\s*保護/,
  /個人情報の取り扱い/,
  /個人情報について/,
  // German
  /datenschutz/i,
  // Korean
  /개인정보/,
  // Chinese
  /隐私/,
  /隱私/,
];

// Privacy metadata patterns
export const JSONLD_PRIVACY_KEYS = ["privacyPolicy", "privacyUrl"];
export const LINK_REL_PRIVACY_VALUES = ["privacy-policy", "privacy"];
export const OG_PRIVACY_PATTERNS = [/privacy/i, /datenschutz/i];

// Footer selectors for privacy policy and TOS links
export const FOOTER_SELECTORS = [
  "footer a",
  '[class*="footer"] a',
  '[id*="footer"] a',
  '[role="contentinfo"] a',
  '[class*="legal"] a',
  '[class*="bottom"] a',
];

// Terms of Service URL patterns (multilingual)
export const TOS_URL_PATTERNS = [
  // Basic patterns
  /\/terms[-_]?of[-_]?service/i,
  /\/terms[-_]?of[-_]?use/i,
  /\/terms[-_]?and[-_]?conditions/i,
  /\/terms/i,
  /\/legal\/terms/i,
  /\/tos/i,
  /\/eula/i,
  // Additional patterns
  /\/user[-_]?agreement/i,
  /\/service[-_]?agreement/i,
  /\/legal\/tos/i,
  /\/legal\/user[-_]?agreement/i,
  /\/policies\/terms/i,
  // German
  /\/agb/i,
  /\/nutzungsbedingungen/i,
  // French
  /\/conditions[-_]?utilisation/i,
  /\/cgu/i,
  // Spanish
  /\/terminos/i,
  /\/condiciones/i,
  // Italian
  /\/termini[-_]?servizio/i,
  // Japanese (URL encoded)
  /\/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84/i,
];

// Terms of Service link text patterns (multilingual)
export const TOS_TEXT_PATTERNS = [
  // English
  /terms\s*of\s*service/i,
  /terms\s*of\s*use/i,
  /terms\s*(&|and)\s*conditions/i,
  /user\s*agreement/i,
  /service\s*agreement/i,
  /end\s*user\s*license\s*agreement/i,
  /eula/i,
  // Japanese
  /利用\s*規約/,
  /ご利用\s*規約/,
  /サービス\s*利用\s*規約/,
  /サービス規約/,
  /ご利用条件/,
  // German
  /allgemeine\s*gesch.ftsbedingungen/i,
  /agb/i,
  /nutzungsbedingungen/i,
  // French
  /conditions\s*(g.n.rales\s*)?d['']utilisation/i,
  /cgu/i,
  // Spanish
  /t.rminos\s*(y\s*condiciones|de\s*servicio|de\s*uso)/i,
  // Italian
  /termini\s*(di\s*servizio|e\s*condizioni)/i,
  // Chinese (Simplified & Traditional)
  /服务\s*条款/,
  /使用\s*条款/,
  /服務\s*條款/,
  // Korean
  /이용\s*약관/,
  /서비스\s*약관/,
];

// ToS metadata patterns
export const TOS_JSONLD_KEYS = ["termsOfService", "termsUrl"];
export const TOS_LINK_REL_VALUES = ["terms-of-service", "terms", "tos"];
export const TOS_OG_PATTERNS = [/terms/i, /tos/i, /agb/i];

// Session cookie name patterns
export const SESSION_COOKIE_PATTERNS = [
  /^sess/i,
  /session/i,
  /^sid$/i,
  /^auth/i,
  /^token/i,
  /^jwt/i,
  /^access[-_]?token/i,
  /^refresh[-_]?token/i,
  /_session$/i,
];

export function isLoginUrl(url: string): boolean {
  return LOGIN_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function isPrivacyUrl(url: string): boolean {
  return PRIVACY_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function isPrivacyText(text: string): boolean {
  return PRIVACY_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isSessionCookie(name: string): boolean {
  return SESSION_COOKIE_PATTERNS.some((pattern) => pattern.test(name));
}

export function isTosUrl(url: string): boolean {
  try {
    const decoded = decodeURIComponent(url);
    return TOS_URL_PATTERNS.some(
      (pattern) => pattern.test(url) || pattern.test(decoded)
    );
  } catch {
    return TOS_URL_PATTERNS.some((pattern) => pattern.test(url));
  }
}

export function isTosText(text: string): boolean {
  return TOS_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}
