/**
 * CSP Reporter
 * Handles optional external reporting of CSP violations and network requests
 */

import type { CSPReport } from "@service-policy-controller/core";

export interface ReportPayload {
  reports: CSPReport[];
  metadata: {
    extensionVersion: string;
    userAgent: string;
    timestamp: string;
  };
}

export class CSPReporter {
  private endpoint: string | null;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(endpoint: string | null) {
    this.endpoint = endpoint;
  }

  async send(reports: CSPReport[]): Promise<boolean> {
    if (!this.endpoint || reports.length === 0) return false;

    const payload: ReportPayload = {
      reports,
      metadata: {
        extensionVersion: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    };

    return this.sendWithRetry(payload);
  }

  private async sendWithRetry(
    payload: ReportPayload,
    attempt = 0
  ): Promise<boolean> {
    if (!this.endpoint) return false;

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.debug(
          `[Service Policy Controller] Report send failed (attempt ${attempt + 1}/${this.maxRetries}), retrying...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, attempt))
        );
        return this.sendWithRetry(payload, attempt + 1);
      }

      console.error(
        "[Service Policy Controller] Failed to send reports after retries:",
        error
      );
      return false;
    }
  }

  setEndpoint(endpoint: string | null) {
    this.endpoint = endpoint;
  }
}
