import {
  createLoginDetector,
  createPrivacyFinder,
  createTosFinder,
  type LoginDetectionResult,
  type PrivacyPolicyResult,
  type TosResult,
} from "@service-policy-auditor/detectors";
import { browserAdapter } from "@/utils/browser-adapter";

// Create detector instances with browser adapter
const loginDetector = createLoginDetector(browserAdapter);
const findPrivacyPolicy = createPrivacyFinder(browserAdapter);
const findTermsOfService = createTosFinder(browserAdapter);

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectionResult;
  privacy: PrivacyPolicyResult;
  tos: TosResult;
}

function analyzePage(): PageAnalysis {
  const url = window.location.href;
  const domain = window.location.hostname;

  return {
    url,
    domain,
    timestamp: Date.now(),
    login: loginDetector.detectLoginPage(),
    privacy: findPrivacyPolicy(),
    tos: findTermsOfService(),
  };
}

async function sendToBackground(analysis: PageAnalysis) {
  try {
    await chrome.runtime.sendMessage({
      type: "PAGE_ANALYZED",
      payload: analysis,
    });
  } catch (error) {
    console.error("[Service Policy Auditor] Failed to send analysis:", error);
  }
}

function runAnalysis() {
  const analysis = analyzePage();

  if (loginDetector.isLoginPage() || analysis.privacy.found || analysis.tos.found) {
    sendToBackground(analysis);
    console.log("[Service Policy Auditor] Page analyzed:", analysis);
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    if (document.readyState === "complete") {
      runAnalysis();
    } else {
      window.addEventListener("load", runAnalysis);
    }
  },
});
