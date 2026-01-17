/**
 * AI Monitor Content Script
 * ai-hooks.jsからのイベントを受信しBackgroundへ転送
 */

import type { CapturedAIPrompt } from "@pleno-audit/detectors";

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
    // ai-hooks.js is now registered via chrome.scripting.registerContentScripts
    // in background.ts, so no need to inject it here

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
