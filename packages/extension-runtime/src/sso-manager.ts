import { createLogger } from "./logger.js";
import {
  getBrowserAPI,
  hasIdentityAPI,
  getSessionStorage,
  setSessionStorage,
  removeSessionStorage,
} from "./browser-adapter.js";
import type { SSOConfig, SSOSession, SSOStatus, SSOProvider } from "./sso-types.js";
import { buildOidcAuthorizeUrl, createSessionFromTokens, exchangeCodeForTokens } from "./sso-oidc.js";
import { buildSamlRequest, parseSamlResponse } from "./sso-saml.js";
import { generateCodeChallenge, generateCodeVerifier, generateRandomString } from "./sso-utils.js";

const logger = createLogger("sso-manager");

class SSOManager {
  private config: SSOConfig | null = null;
  private session: SSOSession | null = null;

  async initializeConfig(): Promise<void> {
    try {
      const api = getBrowserAPI();
      const result = await api.storage.local.get(["ssoConfig", "ssoSession"]);

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

  async startOIDCAuth(): Promise<SSOSession> {
    if (!this.config || this.config.provider !== "oidc") {
      throw new Error("OIDC config not set");
    }

    if (!hasIdentityAPI()) {
      logger.warn("chrome.identity API not available - SSO authentication requires Chrome");
      throw new Error("SSO authentication is not supported in this browser. Please use Chrome.");
    }

    const api = getBrowserAPI();
    const config = this.config;
    const redirectUri = api.identity.getRedirectURL();

    const state = generateRandomString(32);
    const nonce = generateRandomString(32);

    // PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrl = buildOidcAuthorizeUrl(config, redirectUri, {
      state,
      nonce,
      codeChallenge,
    });

    await setSessionStorage("oidcAuthState", { state, nonce, codeVerifier, timestamp: Date.now() });

    logger.info("Starting OIDC auth flow", { authority: config.authority });

    try {
      const redirectUrl = await api.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      });

      if (!redirectUrl) {
        throw new Error("No redirect URL returned from auth flow");
      }

      const responseUrl = new URL(redirectUrl);
      const code = responseUrl.searchParams.get("code");
      const returnedState = responseUrl.searchParams.get("state");

      const authState = await getSessionStorage<{
        state: string;
        nonce: string;
        codeVerifier: string;
        timestamp: number;
      }>("oidcAuthState");

      await removeSessionStorage("oidcAuthState");

      if (!authState) {
        throw new Error("Auth state not found");
      }

      // 5 minute timeout
      if (Date.now() - authState.timestamp > 5 * 60 * 1000) {
        throw new Error("Auth state expired - please try again");
      }

      if (returnedState !== authState.state) {
        throw new Error("State mismatch");
      }

      if (!code) {
        const error = responseUrl.searchParams.get("error");
        const errorDesc = responseUrl.searchParams.get("error_description");
        throw new Error(`Authorization failed: ${error} - ${errorDesc}`);
      }

      const tokens = await exchangeCodeForTokens(config, code, redirectUri, authState.codeVerifier);
      const session = createSessionFromTokens(tokens, "oidc", {
        expectedNonce: authState.nonce,
        expectedIssuer: config.authority,
        expectedAudience: config.clientId,
        logger,
      });
      await this.setSession(session);

      logger.info("OIDC auth completed successfully");
      return session;
    } catch (error) {
      await removeSessionStorage("oidcAuthState");
      logger.error("OIDC auth failed:", error);
      throw error;
    }
  }

  async startSAMLAuth(): Promise<SSOSession> {
    if (!this.config || this.config.provider !== "saml") {
      throw new Error("SAML config not set");
    }

    if (!hasIdentityAPI()) {
      logger.warn("chrome.identity API not available - SSO authentication requires Chrome");
      throw new Error("SSO authentication is not supported in this browser. Please use Chrome.");
    }

    const api = getBrowserAPI();
    const config = this.config;
    const redirectUri = api.identity.getRedirectURL();

    if (!config.entryPoint) {
      throw new Error("SAML entry point not configured");
    }

    const samlRequest = buildSamlRequest(config, redirectUri);
    const idpUrl = new URL(config.entryPoint);
    idpUrl.searchParams.set("SAMLRequest", btoa(samlRequest));
    idpUrl.searchParams.set("RelayState", redirectUri);

    logger.info("Starting SAML auth flow", { entryPoint: config.entryPoint });

    try {
      const redirectUrl = await api.identity.launchWebAuthFlow({
        url: idpUrl.toString(),
        interactive: true,
      });

      if (!redirectUrl) {
        throw new Error("No redirect URL returned from auth flow");
      }

      const responseUrl = new URL(redirectUrl);
      const samlResponse = responseUrl.searchParams.get("SAMLResponse");

      if (!samlResponse) {
        throw new Error("No SAML Response in redirect URL");
      }

      const session = parseSamlResponse(samlResponse, {
        config,
        logger,
      });
      await this.setSession(session);

      logger.info("SAML auth completed successfully");
      return session;
    } catch (error) {
      logger.error("SAML auth failed:", error);
      throw error;
    }
  }

  async refreshToken(): Promise<SSOSession | null> {
    if (!this.config || this.config.provider !== "oidc" || !this.session?.refreshToken) {
      return null;
    }

    const config = this.config;
    const baseAuthority = config.authority.replace(/\/$/, "");
    const tokenUrl = `${baseAuthority}/token`;
    const timeoutMs = 10000;

    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", this.session.refreshToken);
    params.set("client_id", config.clientId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      if (!response.ok) {
        logger.warn("Token refresh failed, clearing session");
        await this.clearSession();
        return null;
      }

      const tokens = await response.json();
      const session = createSessionFromTokens(tokens, "oidc", {
        expectedIssuer: config.authority,
        expectedAudience: config.clientId,
        logger,
      });
      await this.setSession(session);

      logger.info("Token refreshed successfully");
      return session;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.warn("Token refresh timed out, clearing session");
        await this.clearSession();
        return null;
      }
      logger.error("Token refresh failed:", error);
      await this.clearSession();
      return null;
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
      const api = getBrowserAPI();
      await api.storage.local.set({ ssoConfig: config });
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
      const api = getBrowserAPI();
      await api.storage.local.set({ ssoSession: session });
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
    const isValid = this.session !== null &&
                    (!this.session.expiresAt || this.session.expiresAt > Date.now());

    return {
      enabled: this.config !== null,
      provider: this.config?.provider,
      isAuthenticated: Boolean(isValid),
      userEmail: this.session?.userEmail,
      expiresAt: this.session?.expiresAt,
      expiresInSeconds: this.session?.expiresAt ?
        Math.floor((this.session.expiresAt - Date.now()) / 1000) : undefined,
    };
  }

  async clearSession(): Promise<{ success: boolean }> {
    try {
      this.session = null;
      const api = getBrowserAPI();
      await api.storage.local.remove(["ssoSession"]);
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
      const api = getBrowserAPI();
      await api.storage.local.remove(["ssoConfig", "ssoSession"]);
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

export type { SSOProvider, OIDCConfig, SAMLConfig, SSOConfig, SSOSession, SSOStatus } from "./sso-types.js";
