import { createLogger } from "./logger.js";

const logger = createLogger("sso-manager");

export type SSOProvider = "oidc" | "saml";

export interface OIDCConfig {
  provider: "oidc";
  clientId: string;
  clientSecret?: string;
  authority: string;
  redirectUri?: string;
  scope?: string;
}

export interface SAMLConfig {
  provider: "saml";
  entityId: string;
  certificateX509?: string;
  entryPoint?: string;
  issuer?: string;
}

export type SSOConfig = OIDCConfig | SAMLConfig;

export interface SSOSession {
  provider: SSOProvider;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  userId?: string;
  userEmail?: string;
}

export interface SSOStatus {
  enabled: boolean;
  provider?: SSOProvider;
  isAuthenticated: boolean;
  userEmail?: string;
  expiresAt?: number;
  lastRefreshed?: number;
}

class SSOManager {
  private config: SSOConfig | null = null;
  private session: SSOSession | null = null;

  async initializeConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(["ssoConfig", "ssoSession"]);

      if (result.ssoConfig) {
        this.config = result.ssoConfig as SSOConfig;
        logger.debug("SSO config loaded");
      }

      if (result.ssoSession) {
        this.session = result.ssoSession as SSOSession;
        logger.debug("SSO session loaded");
      }
    } catch (error) {
      logger.error("Failed to initialize SSO config:", error);
    }
  }

  async setConfig(config: SSOConfig): Promise<{ success: boolean }> {
    try {
      // Validate config
      if (config.provider === "oidc") {
        if (!config.clientId || !config.authority) {
          return { success: false };
        }
      } else if (config.provider === "saml") {
        if (!config.entityId) {
          return { success: false };
        }
      }

      this.config = config;
      await chrome.storage.local.set({ ssoConfig: config });
      logger.info(`SSO config set for provider: ${config.provider}`);
      return { success: true };
    } catch (error) {
      logger.error("Failed to set SSO config:", error);
      return { success: false };
    }
  }

  async getConfig(): Promise<SSOConfig | null> {
    return this.config;
  }

  async setSession(session: SSOSession): Promise<{ success: boolean }> {
    try {
      this.session = session;
      await chrome.storage.local.set({ ssoSession: session });
      logger.debug("SSO session saved");
      return { success: true };
    } catch (error) {
      logger.error("Failed to set SSO session:", error);
      return { success: false };
    }
  }

  async getSession(): Promise<SSOSession | null> {
    if (!this.session) return null;

    // Check if token is expired
    if (this.session.expiresAt && this.session.expiresAt < Date.now()) {
      logger.warn("SSO token expired");
      return null;
    }

    return this.session;
  }

  async getStatus(): Promise<SSOStatus> {
    const isValid = this.session &&
                    (!this.session.expiresAt || this.session.expiresAt > Date.now());

    return {
      enabled: this.config !== null,
      provider: this.config?.provider,
      isAuthenticated: isValid,
      userEmail: this.session?.userEmail,
      expiresAt: this.session?.expiresAt,
      lastRefreshed: this.session?.expiresAt ?
        Math.floor((this.session.expiresAt - Date.now()) / 1000) : undefined,
    };
  }

  async clearSession(): Promise<{ success: boolean }> {
    try {
      this.session = null;
      await chrome.storage.local.remove(["ssoSession"]);
      logger.info("SSO session cleared");
      return { success: true };
    } catch (error) {
      logger.error("Failed to clear SSO session:", error);
      return { success: false };
    }
  }

  async disableSSO(): Promise<{ success: boolean }> {
    try {
      this.config = null;
      this.session = null;
      await chrome.storage.local.remove(["ssoConfig", "ssoSession"]);
      logger.info("SSO disabled and cleared");
      return { success: true };
    } catch (error) {
      logger.error("Failed to disable SSO:", error);
      return { success: false };
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getProvider(): SSOProvider | null {
    return this.config?.provider || null;
  }
}

export async function createSSOManager(): Promise<SSOManager> {
  const manager = new SSOManager();
  await manager.initializeConfig();
  return manager;
}

let ssoManagerInstance: SSOManager | null = null;

export async function getSSOManager(): Promise<SSOManager> {
  if (!ssoManagerInstance) {
    ssoManagerInstance = await createSSOManager();
  }
  return ssoManagerInstance;
}
