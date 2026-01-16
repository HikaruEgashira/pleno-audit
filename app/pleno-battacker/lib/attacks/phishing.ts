import type { AttackResult, AttackTest } from "../types";

async function simulateTabnabbing(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "No active tab found",
      };
    }

    const originalUrl = tabs[0].url;
    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Tab access successful, current URL: ${originalUrl?.substring(0, 50)}...`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Tab access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateClipboardHijack(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const maliciousContent = "malicious-crypto-address-1234567890";
    await navigator.clipboard.writeText(maliciousContent);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "Clipboard hijack successful - content replaced",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Clipboard hijack blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateHistoryAccess(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const historyItems = await chrome.history.search({
      text: "",
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
      maxResults: 100,
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `History access successful, found ${historyItems.length} items`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `History access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const phishingAttacks: AttackTest[] = [
  {
    id: "phishing-tabnabbing",
    name: "Tabnabbing",
    category: "phishing",
    description: "Attempts to access and monitor browser tabs",
    severity: "high",
    simulate: simulateTabnabbing,
  },
  {
    id: "phishing-clipboard",
    name: "Clipboard Hijacking",
    category: "phishing",
    description: "Attempts to replace clipboard content with malicious data",
    severity: "high",
    simulate: simulateClipboardHijack,
  },
  {
    id: "phishing-history",
    name: "History Access",
    category: "phishing",
    description: "Attempts to read browser history for targeted phishing",
    severity: "medium",
    simulate: simulateHistoryAccess,
  },
];
