import type { DOMAdapter } from "@service-policy-auditor/detectors";

/**
 * Browser DOM adapter implementation
 * Provides access to the browser's document and window objects
 */
export function createBrowserAdapter(): DOMAdapter {
  return {
    querySelector(selector: string): Element | null {
      return document.querySelector(selector);
    },
    querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> {
      return document.querySelectorAll<T>(selector);
    },
    getLocation() {
      return {
        origin: window.location.origin,
        pathname: window.location.pathname,
        href: window.location.href,
      };
    },
  };
}

/**
 * Pre-configured browser adapter instance
 */
export const browserAdapter = createBrowserAdapter();
