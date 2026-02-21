/**
 * AI Monitor Content Script
 * Main worldからの検知イベントをキュー制御し、負荷に応じて非同期バッチ転送する。
 */

type RuntimeEvent = {
  type: string;
  data: Record<string, unknown>;
};

declare global {
  interface Window {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: { timeout?: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  }
}

function isExtensionContextValid(): boolean {
  try {
    return chrome.runtime?.id != null;
  } catch {
    return false;
  }
}

async function sendMessageSafely(message: unknown): Promise<boolean> {
  if (!isExtensionContextValid()) {
    console.warn("[ai-monitor] Extension context is unavailable.");
    return false;
  }

  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    console.warn("[ai-monitor] Failed to send runtime event batch.", error);
    return false;
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    const MAX_QUEUE = 200;
    const MAX_UNLOAD_BATCH = 50;
    const queue: RuntimeEvent[] = [];
    let flushScheduled = false;
    let longTaskDetectedAt = 0;
    let fallbackTimer: number | null = null;
    let consecutiveSendFailures = 0;
    const MAX_SEND_FAILURES = 3;

    const LOW_PRIORITY_TYPES = new Set([
      "COOKIE_ACCESS_DETECTED",
      "DOM_SCRAPING_DETECTED",
      "TRACKING_BEACON_DETECTED",
      "NETWORK_INSPECTION_REQUEST",
    ]);
    const HIGH_PRIORITY_TYPES = new Set([
      "AI_PROMPT_CAPTURED",
      "DATA_EXFILTRATION_DETECTED",
      "XSS_DETECTED",
      "SUSPICIOUS_DOWNLOAD_DETECTED",
      "CREDENTIAL_THEFT_DETECTED",
      "SUPPLY_CHAIN_RISK_DETECTED",
    ]);
    const lastLowPrioritySentAt = new Map<string, number>();

    function isHighLoad(now: number): boolean {
      return now - longTaskDetectedAt < 2000 || queue.length > 80;
    }

    function throttleLowPriority(type: string, now: number): boolean {
      if (!LOW_PRIORITY_TYPES.has(type)) return false;
      const prev = lastLowPrioritySentAt.get(type) ?? 0;
      const minInterval = isHighLoad(now) ? 2000 : 800;
      if (now - prev < minInterval) return true;
      lastLowPrioritySentAt.set(type, now);
      return false;
    }

    function pushEvent(type: string, detail: unknown): void {
      const now = Date.now();
      if (throttleLowPriority(type, now)) return;

      const payload = (detail && typeof detail === "object"
        ? (detail as Record<string, unknown>)
        : {}) as Record<string, unknown>;

      if (queue.length >= MAX_QUEUE) {
        const hasHighPriority = HIGH_PRIORITY_TYPES.has(type);
        if (!hasHighPriority) return;
        queue.shift();
      }

      queue.push({
        type,
        data: {
          ...payload,
          source: "ai-monitor",
          queuedAt: now,
        },
      });

      scheduleFlush();
    }

    function scheduleFlush(): void {
      if (flushScheduled) return;
      flushScheduled = true;

      const now = Date.now();
      const highLoad = isHighLoad(now);
      const timeoutMs = highLoad ? 600 : 120;

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(
          (deadline) => {
            void flushQueue(deadline);
          },
          { timeout: timeoutMs },
        );
        return;
      }

      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null;
        void flushQueue();
      }, timeoutMs);
    }

    async function flushQueue(deadline?: IdleDeadline): Promise<void> {
      flushScheduled = false;
      if (queue.length === 0) return;

      const now = Date.now();
      const highLoad = isHighLoad(now);
      const batchSize = highLoad ? 12 : 40;
      const start = performance.now();
      const budgetMs = highLoad ? 2 : 6;

      const batch: RuntimeEvent[] = [];
      while (queue.length > 0 && batch.length < batchSize) {
        if (deadline && deadline.timeRemaining() <= 1) break;
        if (!deadline && performance.now() - start >= budgetMs) break;
        const item = queue.shift();
        if (item) batch.push(item);
      }

      if (batch.length > 0) {
        const sent = await sendMessageSafely({
          type: "BATCH_RUNTIME_EVENTS",
          data: {
            events: batch,
          },
        });
        if (!sent) {
          consecutiveSendFailures += 1;
          if (consecutiveSendFailures >= MAX_SEND_FAILURES) {
            console.warn(
              `[ai-monitor] Dropping ${batch.length} queued events after repeated send failures.`
            );
            return;
          }
          queue.unshift(...batch);
          window.setTimeout(
            () => scheduleFlush(),
            500 * consecutiveSendFailures
          );
          return;
        }
        consecutiveSendFailures = 0;
      }

      if (queue.length > 0) {
        scheduleFlush();
      }
    }

    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            longTaskDetectedAt = Date.now();
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // longtask is not available in all pages/browsers
      }
    }

    const securityEvents = [
      "__AI_PROMPT_CAPTURED__",
      "__SERVICE_DETECTION_NETWORK__",
      "__DATA_EXFILTRATION_DETECTED__",
      "__CREDENTIAL_THEFT_DETECTED__",
      "__SUPPLY_CHAIN_RISK_DETECTED__",
      "__TRACKING_BEACON_DETECTED__",
      "__NETWORK_INSPECTION_REQUEST__",
      "__CLIPBOARD_HIJACK_DETECTED__",
      "__COOKIE_ACCESS_DETECTED__",
      "__XSS_DETECTED__",
      "__DOM_SCRAPING_DETECTED__",
      "__SUSPICIOUS_DOWNLOAD_DETECTED__",
    ];

    for (const eventType of securityEvents) {
      window.addEventListener(eventType, ((event: CustomEvent) => {
        const type = eventType.replace(/^__|__$/g, "");
        queueMicrotask(() => pushEvent(type, event.detail));
      }) as EventListener);
    }

    window.addEventListener("beforeunload", () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (queue.length > 0) {
        const batch = queue.splice(0, MAX_UNLOAD_BATCH);
        void sendMessageSafely({
          type: "BATCH_RUNTIME_EVENTS",
          data: { events: batch },
        });
      }
    });
  },
});
