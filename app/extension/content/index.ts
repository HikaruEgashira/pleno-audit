import { detectLoginPage, isLoginPage } from "./login-detector";
import { findPrivacyPolicy } from "./privacy-finder";

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
    console.error("[AI Service Exposure] Failed to send analysis:", error);
  }
}

function init() {
  if (document.readyState === "complete") {
    runAnalysis();
  } else {
    window.addEventListener("load", runAnalysis);
  }
}

function runAnalysis() {
  const analysis = analyzePage();

  if (isLoginPage() || analysis.privacy.found) {
    sendToBackground(analysis);
    console.log("[AI Service Exposure] Page analyzed:", analysis);
  }
}

init();
