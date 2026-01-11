/**
 * Input Monitor Content Script
 * input-hooks.jsからのイベントを受信しBackgroundへ転送
 */

import type { CapturedInput } from "@pleno-audit/detectors";

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
    // Inject input hooks script into main world
    injectInputHooksScript();

    // Listen for input capture events from main world
    window.addEventListener(
      "__INPUT_CAPTURED__",
      ((event: CustomEvent<CapturedInput>) => {
        safeSendMessage({
          type: "INPUT_CAPTURED",
          data: event.detail,
        });
      }) as EventListener
    );

    // 後方互換: AIイベントもリッスン
    window.addEventListener(
      "__AI_PROMPT_CAPTURED__",
      ((event: CustomEvent<CapturedInput>) => {
        safeSendMessage({
          type: "INPUT_CAPTURED",
          data: event.detail,
        });
      }) as EventListener
    );
  },
});

function injectInputHooksScript() {
  if (!isExtensionContextValid()) return;
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("/input-hooks.js");
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}
