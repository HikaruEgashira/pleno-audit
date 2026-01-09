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
  /\/policies\/privacy/i,
  /\/policy\/privacy/i,
  /\/data[-_]?protection/i,
  /\/data[-_]?privacy/i,
  /\/privacy[-_]?notice/i,
  /\/gdpr/i,
  /\/dsgvo/i,
  /\/datenschutz/i,
  /\/datenschutzerklaerung/i,
  /\/confidentialite/i,
  /\/politique-de-confidentialite/i,
  /\/privacidad/i,
  /\/politica-de-privacidad/i,
  /\/kojinjouhou/i,
  /\/yinsi/i,
  /\/gaein-jeongbo/i,
];

// Privacy policy URL exclusions (settings pages, not policy pages)
export const PRIVACY_URL_EXCLUSIONS = [
  /privacyprefs/i,
  /privacy[-_]?settings/i,
  /privacy[-_]?preferences/i,
  /privacy[-_]?center/i,
  /manage[-_]?privacy/i,
  /privacy[-_]?controls/i,
  /privacy[-_]?options/i,
];

// Privacy policy link text patterns (multilingual)
export const PRIVACY_TEXT_PATTERNS = [
  /privacy\s*policy/i,
  /privacy\s*notice/i,
  /data\s*protection/i,
  /data\s*privacy/i,
  /your\s*privacy/i,
  /プライバシー\s*ポリシー/,
  /個人情報\s*保護/,
  /個人情報の取り扱い/,
  /個人情報について/,
  /datenschutz/i,
  /datenschutzerkl[äa]rung/i,
  /datenschutzhinweise/i,
  /datenschutzrichtlinie/i,
  /politique\s*de\s*confidentialit[ée]/i,
  /confidentialit[ée]/i,
  /protection\s*des\s*donn[ée]es/i,
  /pol[ií]tica\s*de\s*privacidad/i,
  /privacidad/i,
  /protecci[oó]n\s*de\s*datos/i,
  /informativa\s*sulla\s*privacy/i,
  /protezione\s*dei\s*dati/i,
  /pol[ií]tica\s*de\s*privacidade/i,
  /privacidade/i,
  /隐私\s*政策/,
  /隐私\s*条款/,
  /隱私\s*政策/,
  /隱私\s*條款/,
  /个人信息保护/,
  /個人資料保護/,
  /개인정보\s*처리방침/,
  /개인정보\s*보호정책/,
  /프라이버시\s*정책/,
  /privacybeleid/i,
  /privacyverklaring/i,
  /политика\s*конфиденциальности/i,
  /конфиденциальность/i,
];

// Footer selectors for privacy policy links
export const FOOTER_SELECTORS = [
  "footer a",
  '[class*="footer"] a',
  '[id*="footer"] a',
  '[role="contentinfo"] a',
  '[class*="legal"] a',
  '[class*="policy"] a',
  '[class*="policies"] a',
  '[class*="terms"] a',
  '[class*="bottom"] a',
  '[class*="copyright"] a',
  '[class*="site-info"] a',
  '[class*="nav-footer"] a',
  '[class*="footer-nav"] a',
  '[class*="footer-links"] a',
  '[class*="footer-menu"] a',
  '[data-testid*="footer"] a',
  '[aria-label*="footer" i] a',
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

// Metadata detection patterns
export const OG_PRIVACY_PATTERNS = [
  /privacy/i,
  /datenschutz/i,
  /confidentialite/i,
  /privacidad/i,
];

export const JSONLD_PRIVACY_KEYS = ["privacyPolicy", "privacyUrl"];

export const LINK_REL_PRIVACY_VALUES = ["privacy-policy", "privacy"];

export function isLoginUrl(url: string): boolean {
  return LOGIN_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function isPrivacyUrl(url: string): boolean {
  if (PRIVACY_URL_EXCLUSIONS.some((pattern) => pattern.test(url))) {
    return false;
  }
  return PRIVACY_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function isPrivacyText(text: string): boolean {
  return PRIVACY_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isSessionCookie(name: string): boolean {
  return SESSION_COOKIE_PATTERNS.some((pattern) => pattern.test(name));
}
