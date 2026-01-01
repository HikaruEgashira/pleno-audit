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
];

// Privacy policy link text patterns (multilingual)
export const PRIVACY_TEXT_PATTERNS = [
  /privacy\s*policy/i,
  /privacy\s*notice/i,
  /プライバシー\s*ポリシー/,
  /個人情報\s*保護/,
  /個人情報の取り扱い/,
  /個人情報について/,
];

// Footer selectors for privacy policy links
export const FOOTER_SELECTORS = [
  "footer a",
  '[class*="footer"] a',
  '[id*="footer"] a',
  '[role="contentinfo"] a',
  '[class*="legal"] a',
  '[class*="bottom"] a',
];

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
