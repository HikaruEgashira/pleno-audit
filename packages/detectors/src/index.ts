// CASB Domain Types
export type {
  DetectedService,
  CookieInfo,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  CookieSetDetails,
  NRDDetectedDetails,
  EventLogBase,
  EventLog,
  EventLogType,
} from "./casb-types.js";

// NRD Detection Types
export type {
  HeuristicScores,
  NRDResult,
  NRDConfig,
  NRDDetectionMethod,
  NRDConfidence,
  NRDCache,
} from "./nrd-types.js";

export { DEFAULT_NRD_CONFIG } from "./nrd-types.js";

// NRD Heuristic Detection
export {
  SUSPICIOUS_TLDS,
  calculateEntropy,
  extractSLD,
  extractTLD,
  hasExcessiveHyphens,
  hasExcessiveNumbers,
  isRandomLooking,
  calculateHeuristics,
  isHighRiskHeuristics,
} from "./nrd-heuristics.js";

// NRD RDAP Client
export type { RDAPEvent, RDAPResponse } from "./nrd-rdap.js";
export {
  queryRDAP,
  extractRegistrationDate,
  extractDomainStatus,
} from "./nrd-rdap.js";

// NRD Detector Factory
export { createNRDDetector } from "./nrd-detector.js";

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

// AI Prompt Detection Types
export type {
  InferredProvider,
  AIDetectionMethod,
  CapturedAIPrompt,
  AIPromptContent,
  AIResponseContent,
  AIPromptSentDetails,
  AIResponseReceivedDetails,
  AIMonitorConfig,
} from "./ai-types.js";

export { DEFAULT_AI_MONITOR_CONFIG } from "./ai-types.js";

// AI Prompt Detection
export {
  isAIRequestBody,
  extractPromptContent,
  extractModel,
  extractResponseContent,
  inferProviderFromResponse,
} from "./ai-detector.js";

// Typosquatting Detection Types
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
} from "./typosquat-types.js";

export { DEFAULT_TYPOSQUAT_CONFIG } from "./typosquat-types.js";

// Typosquatting Heuristic Detection
export {
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
} from "./typosquat-heuristics.js";

// Typosquatting Detector Factory
export type { TyposquatCache } from "./typosquat-detector.js";
export { createTyposquatDetector } from "./typosquat-detector.js";
