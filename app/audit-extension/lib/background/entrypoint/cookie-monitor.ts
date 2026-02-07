import { onCookieChange, startCookieMonitor } from "@pleno-audit/extension-runtime";
import type { BackgroundContext } from "./context";

export function registerCookieMonitor(context: BackgroundContext): void {
  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");
    context.backgroundStorage
      .addCookieToService(domain, cookie)
      .catch((err) => context.logger.debug("Add cookie to service failed:", err));
    context.backgroundEvents
      .addEvent({
        type: "cookie_set",
        domain,
        timestamp: cookie.detectedAt,
        details: {
          name: cookie.name,
          isSession: cookie.isSession,
        },
      })
      .catch((err) => context.logger.debug("Add cookie event failed:", err));
  });
}
