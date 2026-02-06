import type { Logger } from "@pleno-audit/extension-runtime";

interface BackgroundInitializerDeps {
  logger: Logger;
  initializeDebugBridge: () => void;
  initializeEventStore: () => Promise<void>;
  initializeApiClient: () => Promise<void>;
  initializeSyncManager: () => Promise<void>;
  initializeEnterpriseManagedFlow: () => Promise<void>;
  initializeCSPReporter: () => Promise<void>;
  migrateLegacyEventsIfNeeded: () => Promise<void>;
  initExtensionMonitor: () => Promise<void>;
}

export function initializeBackgroundServices(deps: BackgroundInitializerDeps): void {
  deps.initializeDebugBridge();

  void deps.initializeEventStore().catch((error) =>
    deps.logger.error("EventStore init failed:", error)
  );
  void deps.initializeApiClient().catch((error) =>
    deps.logger.debug("API client init failed:", error)
  );
  void deps.initializeSyncManager().catch((error) =>
    deps.logger.debug("Sync manager init failed:", error)
  );
  void deps.initializeEnterpriseManagedFlow().catch((error) =>
    deps.logger.error("Enterprise manager init failed:", error)
  );
  void deps.initializeCSPReporter().catch((error) =>
    deps.logger.error("CSP reporter init failed:", error)
  );
  void deps.migrateLegacyEventsIfNeeded().catch((error) =>
    deps.logger.error("Event migration error:", error)
  );
  void deps
    .initExtensionMonitor()
    .then(() => deps.logger.info("Extension monitor initialization completed"))
    .catch((error) => deps.logger.error("Extension monitor init failed:", error));
}
