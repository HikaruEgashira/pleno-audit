import {
  createLoginDetector,
  createPrivacyFinder,
  createTosFinder,
  type LoginDetectionResult,
  type PrivacyPolicyResult,
  type TosResult,
} from "@pleno-audit/detectors";
import { browserAdapter } from "@pleno-audit/extension-runtime";

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
  faviconUrl: string | null;
}

function findFaviconFromDOM(): string | null {
  // <link rel="icon"> または <link rel="shortcut icon"> を探す
  const iconLinks = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel*="apple-touch-icon"]'
  );

  for (const link of iconLinks) {
    if (link.href) {
      return link.href;
    }
  }

  // デフォルトの /favicon.ico を試す
  return `${window.location.origin}/favicon.ico`;
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
    faviconUrl: findFaviconFromDOM(),
  };
}

async function sendToBackground(analysis: PageAnalysis) {
  try {
    await chrome.runtime.sendMessage({
      type: "PAGE_ANALYZED",
      payload: analysis,
    });
  } catch (error) {
    console.error("[Pleno Audit] Failed to send analysis:", error);
  }
}

async function checkNRD(domain: string) {
  try {
    await chrome.runtime.sendMessage({
      type: "CHECK_NRD",
      data: { domain },
    });
  } catch (error) {
    console.error("[Pleno Audit] NRD check failed:", error);
  }
}

async function checkTyposquat(domain: string) {
  try {
    await chrome.runtime.sendMessage({
      type: "CHECK_TYPOSQUAT",
      data: { domain },
    });
  } catch (error) {
    console.error("[Pleno Audit] Typosquat check failed:", error);
  }
}

async function runAnalysis() {
  const analysis = analyzePage();
  const { login, privacy, tos, domain, faviconUrl } = analysis;

  // Send to background if any info found (including favicon)
  if (login.hasPasswordInput || login.isLoginUrl || privacy.found || tos.found || faviconUrl) {
    await sendToBackground(analysis);
  }

  // Check NRD in background (non-blocking)
  checkNRD(domain);

  // Check Typosquatting in background (non-blocking)
  checkTyposquat(domain);
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    if (document.readyState === "complete") {
      runAnalysis().catch(console.error);
    } else {
      window.addEventListener("load", () => {
        runAnalysis().catch(console.error);
      });
    }
  },
});
