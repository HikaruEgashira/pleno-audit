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

// Token response from OIDC token endpoint
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

// Decoded JWT claims (simplified)
interface JWTClaims {
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
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

  /**
   * Start OIDC authentication flow using chrome.identity API
   */
  async startOIDCAuth(): Promise<SSOSession> {
    if (!this.config || this.config.provider !== "oidc") {
      throw new Error("OIDC config not set");
    }

    const config = this.config;
    const redirectUri = chrome.identity.getRedirectURL();

    // Build authorization URL
    const authUrl = new URL(`${config.authority}/authorize`);
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", config.scope || "openid profile email");
    // Add state for CSRF protection
    const state = this.generateRandomString(32);
    authUrl.searchParams.set("state", state);

    logger.info("Starting OIDC auth flow", { authority: config.authority });

    try {
      // Launch web auth flow
      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      });

      if (!redirectUrl) {
        throw new Error("No redirect URL returned from auth flow");
      }

      // Parse the redirect URL to get authorization code
      const responseUrl = new URL(redirectUrl);
      const code = responseUrl.searchParams.get("code");
      const returnedState = responseUrl.searchParams.get("state");

      if (returnedState !== state) {
        throw new Error("State mismatch - possible CSRF attack");
      }

      if (!code) {
        const error = responseUrl.searchParams.get("error");
        const errorDesc = responseUrl.searchParams.get("error_description");
        throw new Error(`Authorization failed: ${error} - ${errorDesc}`);
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code, redirectUri);
      const session = await this.createSessionFromTokens(tokens, "oidc");
      await this.setSession(session);

      logger.info("OIDC auth completed successfully");
      return session;
    } catch (error) {
      logger.error("OIDC auth failed:", error);
      throw error;
    }
  }

  /**
   * Start SAML authentication flow using chrome.identity API
   */
  async startSAMLAuth(): Promise<SSOSession> {
    if (!this.config || this.config.provider !== "saml") {
      throw new Error("SAML config not set");
    }

    const config = this.config;
    const redirectUri = chrome.identity.getRedirectURL();

    if (!config.entryPoint) {
      throw new Error("SAML entry point not configured");
    }

    // Build SAML AuthnRequest
    const samlRequest = this.buildSAMLRequest(config, redirectUri);

    // Build IdP URL with SAML Request
    const idpUrl = new URL(config.entryPoint);
    idpUrl.searchParams.set("SAMLRequest", btoa(samlRequest));
    idpUrl.searchParams.set("RelayState", redirectUri);

    logger.info("Starting SAML auth flow", { entryPoint: config.entryPoint });

    try {
      // Launch web auth flow
      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: idpUrl.toString(),
        interactive: true,
      });

      if (!redirectUrl) {
        throw new Error("No redirect URL returned from auth flow");
      }

      // Parse the SAML Response from the redirect URL
      const responseUrl = new URL(redirectUrl);
      const samlResponse = responseUrl.searchParams.get("SAMLResponse");

      if (!samlResponse) {
        throw new Error("No SAML Response in redirect URL");
      }

      // Parse SAML Response (simplified - in production use a proper SAML library)
      const session = await this.parseSAMLResponse(samlResponse);
      await this.setSession(session);

      logger.info("SAML auth completed successfully");
      return session;
    } catch (error) {
      logger.error("SAML auth failed:", error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens (OIDC)
   */
  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    if (!this.config || this.config.provider !== "oidc") {
      throw new Error("OIDC config not set");
    }

    const config = this.config;
    const tokenUrl = `${config.authority}/token`;

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("client_id", config.clientId);
    if (config.clientSecret) {
      params.set("client_secret", config.clientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Create session from token response
   */
  private async createSessionFromTokens(tokens: TokenResponse, provider: SSOProvider): Promise<SSOSession> {
    const session: SSOSession = {
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    };

    // Try to extract user info from ID token
    if (tokens.id_token) {
      try {
        const claims = this.decodeJWT(tokens.id_token);
        session.userId = claims.sub;
        session.userEmail = claims.email;
        if (claims.exp) {
          session.expiresAt = claims.exp * 1000;
        }
      } catch (error) {
        logger.warn("Failed to decode ID token:", error);
      }
    }

    return session;
  }

  /**
   * Build SAML AuthnRequest (simplified)
   */
  private buildSAMLRequest(config: SAMLConfig, assertionConsumerServiceURL: string): string {
    const id = `_${this.generateRandomString(32)}`;
    const issueInstant = new Date().toISOString();
    const issuer = config.entityId;

    // Simplified SAML AuthnRequest - in production use a proper SAML library
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    ID="${id}"
    Version="2.0"
    IssueInstant="${issueInstant}"
    AssertionConsumerServiceURL="${assertionConsumerServiceURL}"
    Destination="${config.entryPoint}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml:Issuer>
</samlp:AuthnRequest>`;
  }

  /**
   * Parse SAML Response (simplified)
   */
  private async parseSAMLResponse(samlResponse: string): Promise<SSOSession> {
    // Decode base64 SAML Response
    const decoded = atob(samlResponse);

    // Extract basic info using regex (simplified - use proper SAML library in production)
    const emailMatch = decoded.match(/<saml:Attribute Name="email"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i);
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);

    const session: SSOSession = {
      provider: "saml",
      userId: nameIdMatch?.[1],
      userEmail: emailMatch?.[1],
      // SAML sessions typically expire after 8 hours
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };

    // Generate a pseudo access token for session management
    session.accessToken = this.generateRandomString(64);

    return session;
  }

  /**
   * Decode JWT token (simplified - doesn't verify signature)
   */
  private decodeJWT(token: string): JWTClaims {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  }

  /**
   * Generate random string for state/nonce
   */
  private generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Refresh access token using refresh token (OIDC only)
   */
  async refreshToken(): Promise<SSOSession | null> {
    if (!this.config || this.config.provider !== "oidc" || !this.session?.refreshToken) {
      return null;
    }

    const config = this.config;
    const tokenUrl = `${config.authority}/token`;

    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", this.session.refreshToken);
    params.set("client_id", config.clientId);
    if (config.clientSecret) {
      params.set("client_secret", config.clientSecret);
    }

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        logger.warn("Token refresh failed, clearing session");
        await this.clearSession();
        return null;
      }

      const tokens: TokenResponse = await response.json();
      const session = await this.createSessionFromTokens(tokens, "oidc");
      await this.setSession(session);

      logger.info("Token refreshed successfully");
      return session;
    } catch (error) {
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
