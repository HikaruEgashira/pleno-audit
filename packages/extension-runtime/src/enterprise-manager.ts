import { createLogger } from "./logger.js";
import type {
  EnterpriseManagedConfig,
  EnterpriseStatus,
  DetectionConfig,
  BlockingConfig,
  NotificationConfig,
} from "./storage-types.js";
import type { SSOConfig } from "./sso-manager.js";
import { getSSOManager } from "./sso-manager.js";
import { getBrowserAPI, hasManagedStorage, isFirefox } from "./browser-adapter.js";

const logger = createLogger("enterprise-manager");

type ManagedStorageChangeListener = (config: EnterpriseManagedConfig | null) => void;

/**
 * EnterpriseManager handles chrome.storage.managed for MDM-deployed configurations.
 * This enables:
 * - SSO enforcement at startup
 * - Settings lockdown
 * - SIEM reporting integration
 * - Security policy enforcement
 */
class EnterpriseManager {
  private managedConfig: EnterpriseManagedConfig | null = null;
  private listeners: Set<ManagedStorageChangeListener> = new Set();
  private initialized = false;

  /**
   * Initialize the enterprise manager by loading managed storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadManagedConfig();
      this.setupStorageListener();
      this.initialized = true;
      logger.info("EnterpriseManager initialized", {
        isManaged: this.isManaged(),
        ssoRequired: this.isSSORequired(),
        settingsLocked: this.isSettingsLocked(),
      });
    } catch (error) {
      logger.error("Failed to initialize EnterpriseManager:", error);
    }
  }

  /**
   * Load configuration from chrome.storage.managed
   * Note: Managed storage is only available in Chrome Enterprise deployments
   * Firefox does not support chrome.storage.managed
   */
  private async loadManagedConfig(): Promise<void> {
    try {
      // chrome.storage.managed is only available in Chrome with enterprise policy
      // Firefox does not support this API
      if (!hasManagedStorage()) {
        if (isFirefox) {
          logger.debug("Managed storage not available in Firefox - Enterprise features disabled");
        } else {
          logger.debug("chrome.storage.managed not available");
        }
        this.managedConfig = null;
        return;
      }

      const api = getBrowserAPI();
      const result = await api.storage.managed.get(null);

      if (Object.keys(result).length === 0) {
        logger.debug("No managed storage configuration found");
        this.managedConfig = null;
        return;
      }

      // Validate that result contains actual managed config values
      // (not just an empty schema structure)
      const hasValidConfig =
        result.sso?.provider ||
        result.settings?.locked !== undefined ||
        result.reporting?.endpoint ||
        result.policy?.allowedDomains?.length ||
        result.policy?.blockedDomains?.length;

      if (!hasValidConfig) {
        logger.debug("Managed storage exists but contains no valid configuration");
        this.managedConfig = null;
        return;
      }

      this.managedConfig = result as EnterpriseManagedConfig;
      logger.info("Loaded managed configuration", {
        hasSSO: !!this.managedConfig.sso,
        hasSettings: !!this.managedConfig.settings,
        hasReporting: !!this.managedConfig.reporting,
        hasPolicy: !!this.managedConfig.policy,
      });

      // Apply SSO config to SSOManager if configured
      if (this.managedConfig.sso?.provider) {
        await this.applySSOConfig();
      }
    } catch (error) {
      // chrome.storage.managed throws error if no policy is set
      // This is expected behavior for non-enterprise deployments
      if ((error as Error)?.message?.includes("not supported")) {
        logger.debug("Managed storage not supported (non-enterprise deployment)");
      } else {
        logger.warn("Error loading managed config:", error);
      }
      this.managedConfig = null;
    }
  }

  /**
   * Set up listener for managed storage changes
   */
  private setupStorageListener(): void {
    if (!hasManagedStorage()) {
      return;
    }

    const api = getBrowserAPI();
    if (!api.storage.managed?.onChanged) {
      return;
    }

    api.storage.managed.onChanged.addListener((changes) => {
      logger.info("Managed storage changed", { keys: Object.keys(changes) });

      // Reload the full config
      this.loadManagedConfig().then(() => {
        this.notifyListeners();
      });
    });
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  /**
   * Apply SSO configuration from managed storage to SSOManager
   */
  private async applySSOConfig(): Promise<void> {
    if (!this.managedConfig?.sso?.provider) {
      return;
    }

    const ssoManager = await getSSOManager();
    const ssoConfig = this.managedConfig.sso;

    let config: SSOConfig;

    if (ssoConfig.provider === "oidc") {
      if (!ssoConfig.clientId || !ssoConfig.authority) {
        logger.error("OIDC config missing required fields (clientId, authority)");
        return;
      }
      if (!this.isValidUrl(ssoConfig.authority)) {
        logger.error("OIDC authority is not a valid URL:", ssoConfig.authority);
        return;
      }
      config = {
        provider: "oidc",
        clientId: ssoConfig.clientId,
        authority: ssoConfig.authority,
        scope: ssoConfig.scope,
      };
    } else if (ssoConfig.provider === "saml") {
      if (!ssoConfig.entityId) {
        logger.error("SAML config missing required field (entityId)");
        return;
      }
      if (ssoConfig.entryPoint && !this.isValidUrl(ssoConfig.entryPoint)) {
        logger.error("SAML entryPoint is not a valid URL:", ssoConfig.entryPoint);
        return;
      }
      config = {
        provider: "saml",
        entityId: ssoConfig.entityId,
        entryPoint: ssoConfig.entryPoint,
        issuer: ssoConfig.issuer,
      };
    } else {
      logger.error("Unknown SSO provider:", ssoConfig.provider);
      return;
    }

    const result = await ssoManager.setConfig(config);
    if (result.success) {
      logger.info("Applied managed SSO config", { provider: ssoConfig.provider });
    } else {
      logger.error("Failed to apply managed SSO config");
    }
  }

  /**
   * Check if the extension is managed by enterprise policy
   */
  isManaged(): boolean {
    return this.managedConfig !== null;
  }

  /**
   * Check if SSO authentication is required at startup
   */
  isSSORequired(): boolean {
    return this.managedConfig?.sso?.required === true;
  }

  /**
   * Check if settings are locked by administrator
   */
  isSettingsLocked(): boolean {
    return this.managedConfig?.settings?.locked === true;
  }

  /**
   * Get the current enterprise status
   */
  getStatus(): EnterpriseStatus {
    return {
      isManaged: this.isManaged(),
      ssoRequired: this.isSSORequired(),
      settingsLocked: this.isSettingsLocked(),
      config: this.managedConfig,
    };
  }

  /**
   * Get the managed configuration
   */
  getManagedConfig(): EnterpriseManagedConfig | null {
    return this.managedConfig;
  }

  /**
   * Get effective detection config (managed settings override user settings)
   */
  getEffectiveDetectionConfig(userConfig: DetectionConfig): DetectionConfig {
    if (!this.managedConfig?.settings) {
      return userConfig;
    }

    const managed = this.managedConfig.settings;
    return {
      enableNRD: managed.enableNRD ?? userConfig.enableNRD,
      enableTyposquat: managed.enableTyposquat ?? userConfig.enableTyposquat,
      enableAI: managed.enableAI ?? userConfig.enableAI,
      enablePrivacy: managed.enablePrivacy ?? userConfig.enablePrivacy,
      enableTos: managed.enableTos ?? userConfig.enableTos,
      enableLogin: managed.enableLogin ?? userConfig.enableLogin,
      enableExtension: managed.enableExtension ?? userConfig.enableExtension,
    };
  }

  /**
   * Get effective value for a specific setting
   * Managed settings take precedence over user settings
   */
  getEffectiveSetting<K extends keyof DetectionConfig>(
    key: K,
    userValue: DetectionConfig[K]
  ): DetectionConfig[K] {
    if (!this.managedConfig?.settings) {
      return userValue;
    }

    const managedValue = this.managedConfig.settings[key];
    return managedValue !== undefined ? managedValue as DetectionConfig[K] : userValue;
  }

  /**
   * Check if a specific setting is managed (locked)
   */
  isSettingManaged<K extends keyof DetectionConfig>(key: K): boolean {
    if (!this.isSettingsLocked()) {
      return false;
    }
    return this.managedConfig?.settings?.[key] !== undefined;
  }

  /**
   * Get SIEM reporting configuration
   */
  getReportingConfig() {
    return this.managedConfig?.reporting ?? null;
  }

  /**
   * Get security policy configuration
   */
  getPolicyConfig() {
    return this.managedConfig?.policy ?? null;
  }

  /**
   * Get effective blocking config (managed settings override user settings)
   */
  getEffectiveBlockingConfig(userConfig: BlockingConfig): BlockingConfig {
    if (!this.managedConfig?.settings) {
      return userConfig;
    }

    const managed = this.managedConfig.settings;
    return {
      ...userConfig,
      enabled: managed.enableBlocking ?? userConfig.enabled,
    };
  }

  /**
   * Get effective notification config (managed settings override user settings)
   */
  getEffectiveNotificationConfig(userConfig: NotificationConfig): NotificationConfig {
    if (!this.managedConfig?.settings) {
      return userConfig;
    }

    const managed = this.managedConfig.settings;
    return {
      ...userConfig,
      enabled: managed.enableNotifications ?? userConfig.enabled,
    };
  }

  /**
   * Subscribe to managed config changes
   */
  subscribe(listener: ManagedStorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of config change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.managedConfig);
      } catch (error) {
        logger.error("Error in managed config listener:", error);
      }
    }
  }
}

let enterpriseManagerInstance: EnterpriseManager | null = null;

/**
 * Get or create the EnterpriseManager singleton
 */
export async function getEnterpriseManager(): Promise<EnterpriseManager> {
  if (!enterpriseManagerInstance) {
    enterpriseManagerInstance = new EnterpriseManager();
    await enterpriseManagerInstance.initialize();
  }
  return enterpriseManagerInstance;
}

/**
 * Create a new EnterpriseManager instance
 * (mainly for testing purposes)
 */
export function createEnterpriseManager(): EnterpriseManager {
  return new EnterpriseManager();
}

export { EnterpriseManager };
