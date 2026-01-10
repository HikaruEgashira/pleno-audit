/**
 * CSP Content Script
 * Detects CSP violations and bridges communication between page context and background
 * Runs at document_start to catch all violations
 */

import type { CSPViolation, NetworkRequest } from "@service-policy-auditor/csp";

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

        chrome.runtime
          .sendMessage({
            type: "CSP_VIOLATION",
            data: violation,
          })
          .catch(() => {
            // Ignore if extension context is invalid
          });
      },
      true
    );

    // Listen for network events from main world
    // Note: api-hooks.js is registered via chrome.scripting.registerContentScripts in background.ts
    window.addEventListener(
      "__SERVICE_DETECTION_NETWORK__",
      ((event: CustomEvent) => {
        const request: Omit<NetworkRequest, "type" | "domain" | "pageUrl"> & {
          type?: string;
          domain?: string;
          pageUrl?: string;
        } = {
          type: "network-request",
          timestamp: new Date().toISOString(),
          pageUrl: document.location.href,
          url: event.detail.url,
          method: event.detail.method,
          initiator: event.detail.initiator,
          domain: extractDomain(event.detail.url),
          resourceType: event.detail.resourceType,
        };

        chrome.runtime
          .sendMessage({
            type: "NETWORK_REQUEST",
            data: request,
          })
          .catch(() => {
            // Ignore if extension context is invalid
          });
      }) as EventListener
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
