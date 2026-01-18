import {
  createLoginDetector,
  createPrivacyFinder,
  createTosFinder,
  createCookiePolicyFinder,
  createCookieBannerFinder,
  type LoginDetectionResult,
  type PrivacyPolicyResult,
  type TosResult,
  type CookiePolicyResult,
  type CookieBannerResult,
} from "@pleno-audit/detectors";
import { browserAdapter } from "@pleno-audit/extension-runtime";

// Create detector instances with browser adapter
const loginDetector = createLoginDetector(browserAdapter);
const findPrivacyPolicy = createPrivacyFinder(browserAdapter);
const findTermsOfService = createTosFinder(browserAdapter);
const findCookiePolicy = createCookiePolicyFinder(browserAdapter);
const findCookieBanner = createCookieBannerFinder(browserAdapter);

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectionResult;
  privacy: PrivacyPolicyResult;
  tos: TosResult;
  cookiePolicy: CookiePolicyResult;
  cookieBanner: CookieBannerResult;
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
    cookiePolicy: findCookiePolicy(),
    cookieBanner: findCookieBanner(),
    faviconUrl: findFaviconFromDOM(),
  };
}

async function sendToBackground(analysis: PageAnalysis) {
  try {
    await chrome.runtime.sendMessage({
      type: "PAGE_ANALYZED",
      payload: analysis,
    });
  } catch {
    // Failed to send analysis
  }
}

async function checkNRD(domain: string) {
  try {
    await chrome.runtime.sendMessage({
      type: "CHECK_NRD",
      data: { domain },
    });
  } catch {
    // NRD check failed
  }
}

async function checkTyposquat(domain: string) {
  try {
    await chrome.runtime.sendMessage({
      type: "CHECK_TYPOSQUAT",
      data: { domain },
    });
  } catch {
    // Typosquat check failed
  }
}

async function runAnalysis() {
  const analysis = analyzePage();
  const { login, privacy, tos, cookiePolicy, cookieBanner, domain, faviconUrl } = analysis;

  // Send to background if any info found (including favicon and cookie detection)
  if (
    login.hasPasswordInput ||
    login.isLoginUrl ||
    privacy.found ||
    tos.found ||
    cookiePolicy.found ||
    cookieBanner.found ||
    faviconUrl
  ) {
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
      runAnalysis().catch(() => {});
    } else {
      window.addEventListener("load", () => {
        runAnalysis().catch(() => {});
      });
    }
  },
});
