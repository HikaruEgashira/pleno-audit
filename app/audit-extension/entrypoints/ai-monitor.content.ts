/**
 * AI Monitor Content Script
 * ai-hooks.jsからのイベントを受信してBackgroundへ転送
 * ai-hooks.jsはbackground.tsのregisterContentScriptsで注入される
 */

function isExtensionContextValid(): boolean {
  try {
    return chrome.runtime?.id != null;
  } catch {
    return false;
  }
}

function safeSendMessage(message: unknown): void {
  if (!isExtensionContextValid()) return;
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore if extension context is invalid
  });
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    // Listen for security detection events from main world (ai-hooks.js)
    const securityEvents = [
      "__AI_PROMPT_CAPTURED__",
      "__DATA_EXFILTRATION_DETECTED__",
      "__TRACKING_BEACON_DETECTED__",
      "__CLIPBOARD_HIJACK_DETECTED__",
      "__COOKIE_ACCESS_DETECTED__",
      "__XSS_DETECTED__",
      "__DOM_SCRAPING_DETECTED__",
      "__SUSPICIOUS_DOWNLOAD_DETECTED__",
    ];

    for (const eventType of securityEvents) {
      window.addEventListener(eventType, ((event: CustomEvent) => {
        safeSendMessage({
          type: eventType.replace(/^__|__$/g, ""),
          data: {
            ...event.detail,
            source: "ai-monitor",
          },
        });
      }) as EventListener);
    }
  },
});
