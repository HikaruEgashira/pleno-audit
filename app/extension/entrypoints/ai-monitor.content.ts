/**
 * AI Monitor Content Script
 * ai-hooks.jsからのイベントを受信しBackgroundへ転送
 */

import type { CapturedAIPrompt } from "@service-policy-auditor/detectors";

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
    // Inject AI hooks script into main world
    injectAIHooksScript();

    // Listen for AI capture events from main world
    window.addEventListener(
      "__AI_PROMPT_CAPTURED__",
      ((event: CustomEvent<CapturedAIPrompt>) => {
        safeSendMessage({
          type: "AI_PROMPT_CAPTURED",
          data: event.detail,
        });
      }) as EventListener
    );
  },
});

function injectAIHooksScript() {
  if (!isExtensionContextValid()) return;
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("/ai-hooks.js");
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}
