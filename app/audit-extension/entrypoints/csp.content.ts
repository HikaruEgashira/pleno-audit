/**
 * CSP Content Script
 * Detects CSP violations and forwards events to background.
 * Main world custom events are handled by security-bridge.content.ts.
 */

import type { CSPViolation } from "@pleno-audit/csp";

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

function enqueueMessage(message: unknown): void {
  // Avoid doing extension messaging work in the same browser event tick.
  queueMicrotask(() => safeSendMessage(message));
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    // Listen for CSP violation events
    document.addEventListener(
      "securitypolicyviolation",
      (event: SecurityPolicyViolationEvent) => {
        const violation: Omit<CSPViolation, "type"> & { type?: string } = {
          type: "csp-violation",
          timestamp: new Date().toISOString(),
          pageUrl: document.location.href,
          directive: event.violatedDirective,
          blockedURL: event.blockedURI,
          domain: extractDomain(event.blockedURI),
          disposition: event.disposition as "enforce" | "report",
          originalPolicy: event.originalPolicy,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
          statusCode: event.statusCode,
        };

        enqueueMessage({
          type: "CSP_VIOLATION",
          data: violation,
        });
      },
      true
    );
  },
});

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
