// Types
export type {
  DOMAdapter,
  DetectionMethod,
  DetectionResult,
  PrivacyPolicyResult,
  TosResult,
  LoginDetectionResult,
} from "./types.js";

// Detector factories
export { createPrivacyFinder } from "./privacy-finder.js";
export { createTosFinder } from "./tos-finder.js";
export { createLoginDetector } from "./login-detector.js";
