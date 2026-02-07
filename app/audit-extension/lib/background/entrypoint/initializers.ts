import { getEnterpriseManager, getSSOManager } from "@pleno-audit/extension-runtime";
import { checkEventsMigrationNeeded, migrateEventsToIndexedDB } from "@pleno-audit/storage";
import type { BackgroundContext } from "./context";
import type { ExtensionNetworkGateway } from "./extension-network-gateway";

interface BackgroundInitializerParams {
  context: BackgroundContext;
  extensionNetwork: ExtensionNetworkGateway;
  initializeCSPReporter: () => Promise<void>;
  checkMigrationNeeded: () => Promise<boolean>;
  migrateToDatabase: () => Promise<void>;
}

export function createBackgroundInitializers(params: BackgroundInitializerParams) {
  const { context, extensionNetwork, initializeCSPReporter, checkMigrationNeeded, migrateToDatabase } = params;

  function initializeDebugBridge(): void {
    if (!import.meta.env.DEV) {
      return;
    }
    void import("../../debug-bridge.js").then(({ initDebugBridge }) => {
      initDebugBridge();
    });
  }

  async function initializeEventStore(): Promise<void> {
    await context.backgroundEvents.getOrInitParquetStore();
    context.logger.info("EventStore initialized");
  }

  async function initializeEnterpriseManagedFlow(): Promise<void> {
    const enterpriseManager = await getEnterpriseManager();
    const status = enterpriseManager.getStatus();

    if (!status.isManaged) {
      return;
    }

    context.logger.info("Enterprise managed mode detected", {
      ssoRequired: status.ssoRequired,
      settingsLocked: status.settingsLocked,
    });

    if (!status.ssoRequired) {
      return;
    }

    const ssoManager = await getSSOManager();
    const ssoStatus = await ssoManager.getStatus();

    if (ssoStatus.isAuthenticated) {
      return;
    }

    context.logger.info("SSO required but not authenticated - prompting user");

    await chrome.notifications.create("sso-required", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon-128.png"),
      title: "認証が必要です",
      message: "組織のセキュリティポリシーにより、シングルサインオンでの認証が必要です。",
      priority: 2,
      requireInteraction: true,
    });

    const dashboardUrl = chrome.runtime.getURL("dashboard.html#auth");
    await chrome.tabs.create({ url: dashboardUrl, active: true });
  }

  async function migrateLegacyEventsIfNeeded(): Promise<void> {
    const needsMigration = await checkEventsMigrationNeeded();
    if (!needsMigration) {
      return;
    }

    const store = await context.backgroundEvents.getOrInitParquetStore();
    const result = await migrateEventsToIndexedDB(store);
    context.logger.info(`Event migration: ${result.success ? "success" : "failed"}`, result);
  }

  function initializeBackgroundServices(): void {
    initializeDebugBridge();

    void initializeEventStore().catch((error) => context.logger.error("EventStore init failed:", error));
    void context.backgroundApi
      .initializeApiClientWithMigration(checkMigrationNeeded, migrateToDatabase)
      .catch((error) => context.logger.debug("API client init failed:", error));
    void context.backgroundSync.initializeSyncManagerWithAutoStart().catch((error) =>
      context.logger.debug("Sync manager init failed:", error)
    );
    void initializeEnterpriseManagedFlow().catch((error) =>
      context.logger.error("Enterprise manager init failed:", error)
    );
    void initializeCSPReporter().catch((error) => context.logger.error("CSP reporter init failed:", error));
    void migrateLegacyEventsIfNeeded().catch((error) => context.logger.error("Event migration error:", error));
    void extensionNetwork
      .initExtensionMonitor()
      .then(() => context.logger.info("Extension monitor initialization completed"))
      .catch((error) => context.logger.error("Extension monitor init failed:", error));
  }

  return {
    initializeBackgroundServices,
  };
}
