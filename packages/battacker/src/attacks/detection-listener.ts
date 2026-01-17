/**
 * PlenoAudit Detection Event Listener
 * Monitors detection events from PlenoAudit extension
 */

type DetectionEventType =
  | "__DATA_EXFILTRATION_DETECTED__"
  | "__TRACKING_BEACON_DETECTED__"
  | "__CLIPBOARD_HIJACK_DETECTED__"
  | "__COOKIE_ACCESS_DETECTED__"
  | "__XSS_DETECTED__"
  | "__DOM_SCRAPING_DETECTED__"
  | "__SUSPICIOUS_DOWNLOAD_DETECTED__";

interface DetectionState {
  detected: boolean;
  eventType: DetectionEventType | null;
  detail: unknown;
}

/**
 * Creates a detection listener that monitors PlenoAudit detection events
 * @param eventTypes - Array of event types to listen for
 * @param timeout - How long to wait for detection (ms)
 */
export function createDetectionListener(
  eventTypes: DetectionEventType[],
  timeout = 500
): { start: () => void; getState: () => DetectionState; cleanup: () => void } {
  const state: DetectionState = {
    detected: false,
    eventType: null,
    detail: null,
  };

  const handlers: Map<DetectionEventType, (e: Event) => void> = new Map();

  function start() {
    for (const eventType of eventTypes) {
      const handler = (e: Event) => {
        state.detected = true;
        state.eventType = eventType;
        state.detail = (e as CustomEvent).detail;
      };
      handlers.set(eventType, handler);
      window.addEventListener(eventType, handler);
    }
  }

  function getState() {
    return { ...state };
  }

  function cleanup() {
    for (const [eventType, handler] of handlers) {
      window.removeEventListener(eventType, handler);
    }
    handlers.clear();
  }

  return { start, getState, cleanup };
}

/**
 * Wraps an attack simulation with detection monitoring
 * @param simulate - Original simulation function
 * @param eventTypes - Detection events to monitor
 * @param timeout - Detection timeout in ms
 */
export function withDetectionMonitor<T extends { blocked: boolean; detected: boolean }>(
  simulate: () => Promise<T>,
  eventTypes: DetectionEventType[],
  timeout = 100
): () => Promise<T> {
  return async () => {
    const listener = createDetectionListener(eventTypes, timeout);
    listener.start();

    try {
      const result = await simulate();

      // Wait a bit for detection events to propagate
      await new Promise((resolve) => setTimeout(resolve, timeout));

      const detectionState = listener.getState();

      // If PlenoAudit detected the attack, update the result
      if (detectionState.detected && !result.blocked) {
        return {
          ...result,
          detected: true,
          details: result.blocked
            ? (result as unknown as { details?: string }).details
            : `Attack executed but detected by PlenoAudit (${detectionState.eventType})`,
        };
      }

      return result;
    } finally {
      listener.cleanup();
    }
  };
}
