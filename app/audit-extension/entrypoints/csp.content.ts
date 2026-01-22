/**
 * CSP Content Script
 * Detects CSP violations and bridges communication between page context and background
 * Runs at document_start to catch all violations
 */

import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";

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

        safeSendMessage({
          type: "CSP_VIOLATION",
          data: violation,
        });
      },
      true
    );

    // Listen for network events from main world
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

        safeSendMessage({
          type: "NETWORK_REQUEST",
          data: request,
        });
      }) as EventListener
    );

    // Listen for data exfiltration events from main world
    window.addEventListener(
      "__DATA_EXFILTRATION_DETECTED__",
      ((event: CustomEvent) => {
        safeSendMessage({
          type: "DATA_EXFILTRATION_DETECTED",
          data: {
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            targetUrl: event.detail.url,
            targetDomain: event.detail.targetDomain,
            method: event.detail.method,
            bodySize: event.detail.bodySize,
            initiator: event.detail.initiator,
          },
        });
      }) as EventListener
    );

    // Listen for credential theft events from main world
    window.addEventListener(
      "__CREDENTIAL_THEFT_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "CREDENTIAL_THEFT_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            formAction: detail.formAction || "",
            targetDomain: detail.targetDomain || "",
            method: detail.method || "GET",
            isSecure: detail.isSecure ?? true,
            isCrossOrigin: detail.isCrossOrigin ?? false,
            fieldType: detail.fieldType || "unknown",
            risks: detail.risks || [],
          },
        });
      }) as EventListener
    );

    // Listen for supply chain risk events from main world
    window.addEventListener(
      "__SUPPLY_CHAIN_RISK_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "SUPPLY_CHAIN_RISK_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            url: detail.url || "",
            resourceType: detail.resourceType || "script",
            hasIntegrity: detail.hasIntegrity ?? false,
            hasCrossorigin: detail.hasCrossorigin ?? false,
            isCDN: detail.isCDN ?? false,
            risks: detail.risks || [],
          },
        });
      }) as EventListener
    );

    // Listen for tracking beacon events from main world
    window.addEventListener(
      "__TRACKING_BEACON_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "TRACKING_BEACON_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            url: detail.url || "",
            targetDomain: detail.targetDomain || "",
            bodySize: detail.bodySize ?? 0,
            initiator: detail.initiator || "unknown",
          },
        });
      }) as EventListener
    );

    // Listen for clipboard hijack events from main world
    window.addEventListener(
      "__CLIPBOARD_HIJACK_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "CLIPBOARD_HIJACK_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            text: detail.text || "",
            cryptoType: detail.cryptoType || "unknown",
            fullLength: detail.fullLength ?? 0,
          },
        });
      }) as EventListener
    );

    // Listen for cookie access events from main world
    window.addEventListener(
      "__COOKIE_ACCESS_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "COOKIE_ACCESS_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            readCount: detail.readCount ?? 1,
          },
        });
      }) as EventListener
    );

    // Listen for XSS detection events from main world
    window.addEventListener(
      "__XSS_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "XSS_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            type: detail.type || "unknown",
            payloadPreview: detail.payloadPreview || "",
          },
        });
      }) as EventListener
    );

    // Listen for DOM scraping events from main world
    window.addEventListener(
      "__DOM_SCRAPING_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "DOM_SCRAPING_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            selector: detail.selector || "",
            callCount: detail.callCount ?? 0,
          },
        });
      }) as EventListener
    );

    // Listen for suspicious download events from main world
    window.addEventListener(
      "__SUSPICIOUS_DOWNLOAD_DETECTED__",
      ((event: CustomEvent) => {
        const detail = event.detail || {};
        safeSendMessage({
          type: "SUSPICIOUS_DOWNLOAD_DETECTED",
          data: {
            source: "csp",
            timestamp: new Date().toISOString(),
            pageUrl: document.location.href,
            type: detail.type || "unknown",
            filename: detail.filename || "",
            extension: detail.extension || "",
            url: detail.url || "",
            size: detail.size ?? 0,
            mimeType: detail.mimeType || "",
          },
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
