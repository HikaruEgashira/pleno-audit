import { detectLoginPage, isLoginPage } from "@/utils/login-detector";
import { findPrivacyPolicy } from "@/utils/privacy-finder";

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: ReturnType<typeof detectLoginPage>;
  privacy: ReturnType<typeof findPrivacyPolicy>;
}

function analyzePage(): PageAnalysis {
  const url = window.location.href;
  const domain = window.location.hostname;

  return {
    url,
    domain,
    timestamp: Date.now(),
    login: detectLoginPage(),
    privacy: findPrivacyPolicy(),
  };
}

async function sendToBackground(analysis: PageAnalysis) {
  try {
    await chrome.runtime.sendMessage({
      type: "PAGE_ANALYZED",
      payload: analysis,
    });
  } catch (error) {
    console.error("[Service Policy Controller] Failed to send analysis:", error);
  }
}

function runAnalysis() {
  const analysis = analyzePage();

  if (isLoginPage() || analysis.privacy.found) {
    sendToBackground(analysis);
    console.log("[Service Policy Controller] Page analyzed:", analysis);
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
