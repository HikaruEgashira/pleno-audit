// CASB Domain Types
export type {
  DetectedService,
  CookieInfo,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  CookieSetDetails,
  NRDDetectedDetails,
  ExtensionRequestDetails,
  EventLogBase,
  EventLog,
  EventLogType,
} from "./casb-types.js";

// NRD Detection (re-export from @pleno-audit/nrd)
export type {
  SuspiciousDomainScores,
  DDNSInfo,
  DDNSResult,
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
  NRDCache,
  RDAPEvent,
  RDAPResponse,
} from "@pleno-audit/nrd";

export {
  DEFAULT_NRD_CONFIG,
  SUSPICIOUS_TLDS,
  calculateEntropy,
  extractSLD,
  extractTLD,
  hasExcessiveHyphens,
  hasExcessiveNumbers,
  isRandomLooking,
  calculateSuspiciousScore,
  isHighRiskDomain,
  queryRDAP,
  extractRegistrationDate,
  extractDomainStatus,
  DDNS_PROVIDERS,
  checkDDNS,
  getDDNSProviderDomains,
  getDDNSProviderNames,
  createNRDDetector,
} from "@pleno-audit/nrd";

// Detection Types
export type {
  DOMAdapter,
  DetectionMethod,
  DetectionResult,
  PrivacyPolicyResult,
  TosResult,
  LoginDetectionResult,
} from "./types.js";

// Patterns (CASB Domain Knowledge)
export {
  // Authentication Detection
  LOGIN_URL_PATTERNS,
  isLoginUrl,
  // Privacy Policy Detection
  PRIVACY_URL_PATTERNS,
  PRIVACY_TEXT_PATTERNS,
  JSONLD_PRIVACY_KEYS,
  LINK_REL_PRIVACY_VALUES,
  OG_PRIVACY_PATTERNS,
  FOOTER_SELECTORS,
  isPrivacyUrl,
  isPrivacyText,
  // Terms of Service Detection
  TOS_URL_PATTERNS,
  TOS_TEXT_PATTERNS,
  TOS_JSONLD_KEYS,
  TOS_LINK_REL_VALUES,
  TOS_OG_PATTERNS,
  isTosUrl,
  isTosText,
  // Session Detection
  SESSION_COOKIE_PATTERNS,
  isSessionCookie,
} from "./patterns.js";

// URL Utilities
export {
  decodeUrlSafe,
  getPathFromUrl,
  extractOrigin,
  resolveUrl,
} from "./url-utils.js";

// Detector factories
export { createPrivacyFinder } from "./privacy-finder.js";
export { createTosFinder } from "./tos-finder.js";
export { createLoginDetector } from "./login-detector.js";

// AI Prompt Detection (re-export from @pleno-audit/ai-detector)
export type {
  AIDetectionMethod,
  CapturedAIPrompt,
  AIPromptContent,
  AIResponseContent,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  AIMonitorConfig,
} from "@pleno-audit/ai-detector";

export {
  DEFAULT_AI_MONITOR_CONFIG,
  isAIRequestBody,
  extractPromptContent,
  extractResponseContent,
} from "@pleno-audit/ai-detector";

// Typosquatting Detection (re-export from @pleno-audit/typosquat)
export type {
  HomoglyphType,
  HomoglyphMatch,
  ScriptType,
  ScoreBreakdown,
  TyposquatScores,
  TyposquatDetectionMethod,
  TyposquatConfidence,
  TyposquatResult,
  TyposquatConfig,
  TyposquatDetectedDetails,
  TyposquatCache,
} from "@pleno-audit/typosquat";

export {
  DEFAULT_TYPOSQUAT_CONFIG,
  LATIN_HOMOGLYPHS,
  CYRILLIC_TO_LATIN,
  JAPANESE_HOMOGLYPHS,
  getCharacterScript,
  detectScripts,
  isSuspiciousMixedScript,
  detectLatinHomoglyphs,
  detectCyrillicHomoglyphs,
  detectJapaneseHomoglyphs,
  isPunycodeDomain,
  decodePunycode,
  calculateTyposquatHeuristics,
  isHighRiskTyposquat,
  createTyposquatDetector,
} from "@pleno-audit/typosquat";
