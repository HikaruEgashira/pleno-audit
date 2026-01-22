import { createLogger } from "./logger.js";

const logger = createLogger("sso-manager");

export type SSOProvider = "oidc" | "saml";

export interface OIDCConfig {
  provider: "oidc";
  clientId: string;
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

// Decoded JWT claims
interface JWTClaims {
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  nonce?: string;
  iat?: number;
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
   * Uses PKCE (RFC 7636) for secure authorization code exchange
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

    // Add state for CSRF protection - persist to storage for Service Worker restart resilience
    const state = this.generateRandomString(32);
    const nonce = this.generateRandomString(32);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);

    // PKCE: Generate code_verifier and code_challenge (RFC 7636)
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Store state, nonce, and code_verifier in session storage for validation after redirect
    await chrome.storage.session.set({
      oidcAuthState: { state, nonce, codeVerifier, timestamp: Date.now() },
    });

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

      // Retrieve stored state/nonce/codeVerifier for validation
      const storedAuth = await chrome.storage.session.get("oidcAuthState");
      const authState = storedAuth.oidcAuthState as {
        state: string;
        nonce: string;
        codeVerifier: string;
        timestamp: number;
      } | undefined;

      // Clear stored state after retrieval
      await chrome.storage.session.remove("oidcAuthState");

      if (!authState) {
        throw new Error("Auth state not found - session may have expired");
      }

      // Validate state hasn't expired (5 minute timeout)
      if (Date.now() - authState.timestamp > 5 * 60 * 1000) {
        throw new Error("Auth state expired - please try again");
      }

      if (returnedState !== authState.state) {
        throw new Error("State mismatch - possible CSRF attack");
      }

      if (!code) {
        const error = responseUrl.searchParams.get("error");
        const errorDesc = responseUrl.searchParams.get("error_description");
        throw new Error(`Authorization failed: ${error} - ${errorDesc}`);
      }

      // Exchange code for tokens using PKCE
      const tokens = await this.exchangeCodeForTokens(code, redirectUri, authState.codeVerifier);
      const session = await this.createSessionFromTokens(tokens, "oidc", authState.nonce);
      await this.setSession(session);

      logger.info("OIDC auth completed successfully");
      return session;
    } catch (error) {
      // Cleanup on error
      await chrome.storage.session.remove("oidcAuthState");
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
   * Exchange authorization code for tokens using PKCE (RFC 7636)
   */
  private async exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
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
    params.set("code_verifier", codeVerifier);

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
   * Create session from token response with JWT validation
   */
  private async createSessionFromTokens(tokens: TokenResponse, provider: SSOProvider, expectedNonce?: string): Promise<SSOSession> {
    const session: SSOSession = {
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    };

    // Try to extract and validate user info from ID token
    if (tokens.id_token) {
      try {
        const claims = this.decodeAndValidateJWT(tokens.id_token, expectedNonce);
        session.userId = claims.sub;
        session.userEmail = claims.email;
        if (claims.exp) {
          session.expiresAt = claims.exp * 1000;
        }
      } catch (error) {
        logger.warn("Failed to decode/validate ID token:", error);
        // For OIDC, ID token validation failure should be treated seriously
        if (provider === "oidc" && expectedNonce) {
          throw new Error(`ID token validation failed: ${error instanceof Error ? error.message : "unknown error"}`);
        }
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
   * Parse and validate SAML Response
   * Note: Full XML signature verification requires external libraries (xml-crypto, etc.)
   * This implementation validates structure and timestamps but not the cryptographic signature.
   * For production use with untrusted IdPs, consider using a proper SAML library (saml2-js, passport-saml).
   */
  private async parseSAMLResponse(samlResponse: string): Promise<SSOSession> {
    // Decode base64 SAML Response with error handling
    let decoded: string;
    try {
      // Handle URL-safe base64
      const base64 = samlResponse.replace(/-/g, "+").replace(/_/g, "/");
      decoded = atob(base64);
    } catch {
      throw new Error("Failed to decode SAML response - invalid base64");
    }

    // Validate SAML Response structure
    if (!decoded.includes("samlp:Response") && !decoded.includes("Response")) {
      throw new Error("Invalid SAML response - missing Response element");
    }

    // Check for Status element - must be Success
    const statusMatch = decoded.match(/<samlp?:StatusCode[^>]*Value="([^"]+)"/i);
    if (statusMatch) {
      const statusValue = statusMatch[1];
      if (!statusValue.includes("Success")) {
        // Extract status message if available
        const messageMatch = decoded.match(/<samlp?:StatusMessage[^>]*>([^<]+)<\/samlp?:StatusMessage>/i);
        const message = messageMatch?.[1] || "Unknown error";
        throw new Error(`SAML authentication failed: ${message} (status: ${statusValue})`);
      }
    }

    // Validate Conditions timestamps if present
    const notBeforeMatch = decoded.match(/NotBefore="([^"]+)"/);
    const notOnOrAfterMatch = decoded.match(/NotOnOrAfter="([^"]+)"/);
    const now = Date.now();

    if (notBeforeMatch) {
      const notBefore = new Date(notBeforeMatch[1]).getTime();
      // Allow 5 minute clock skew
      if (notBefore > now + 5 * 60 * 1000) {
        throw new Error("SAML assertion not yet valid");
      }
    }

    if (notOnOrAfterMatch) {
      const notOnOrAfter = new Date(notOnOrAfterMatch[1]).getTime();
      // Allow 5 minute clock skew
      if (notOnOrAfter < now - 5 * 60 * 1000) {
        throw new Error("SAML assertion has expired");
      }
    }

    // Validate issuer matches configured IdP (if available)
    if (this.config?.provider === "saml") {
      const issuerMatch = decoded.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/i);
      if (issuerMatch && this.config.issuer && issuerMatch[1] !== this.config.issuer) {
        logger.warn(`SAML issuer mismatch: expected ${this.config.issuer}, got ${issuerMatch[1]}`);
        // Warning only - some IdPs use different issuer values
      }
    }

    // Extract user info using regex (simplified - use proper SAML library in production)
    const emailMatch = decoded.match(/<saml:Attribute Name="email"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i);
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);

    if (!nameIdMatch && !emailMatch) {
      throw new Error("SAML response missing user identifier (NameID or email)");
    }

    // Calculate session expiration from SAML assertion or default to 8 hours
    let expiresAt = now + 8 * 60 * 60 * 1000;
    if (notOnOrAfterMatch) {
      expiresAt = new Date(notOnOrAfterMatch[1]).getTime();
    }

    const session: SSOSession = {
      provider: "saml",
      userId: nameIdMatch?.[1],
      userEmail: emailMatch?.[1],
      expiresAt,
    };

    // Generate a pseudo access token for session management
    session.accessToken = this.generateRandomString(64);

    logger.debug("SAML response validated", {
      userId: session.userId,
      email: session.userEmail,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    return session;
  }

  /**
   * Decode and validate JWT token
   * Note: Full cryptographic signature verification requires external libraries (jose, etc.)
   * This implementation validates claims (iss, aud, exp, nonce) but not the signature.
   * For production use with untrusted IdPs, consider using a proper JWT library.
   */
  private decodeAndValidateJWT(token: string, expectedNonce?: string): JWTClaims {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    let payload: JWTClaims;
    try {
      // Use URL-safe base64 decoding
      const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      payload = JSON.parse(atob(base64Payload));
    } catch {
      throw new Error("Failed to decode JWT payload");
    }

    // Validate issuer matches configured authority
    if (this.config?.provider === "oidc") {
      const config = this.config;
      if (payload.iss && !payload.iss.startsWith(config.authority)) {
        throw new Error(`Invalid issuer: expected ${config.authority}, got ${payload.iss}`);
      }

      // Validate audience contains our client ID
      if (payload.aud) {
        const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!audList.includes(config.clientId)) {
          throw new Error(`Invalid audience: ${config.clientId} not in ${audList.join(", ")}`);
        }
      }
    }

    // Validate nonce if provided (prevents ID token replay attacks)
    if (expectedNonce && payload.nonce !== expectedNonce) {
      throw new Error("Nonce mismatch - possible replay attack");
    }

    // Validate expiration
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      // Allow 5 minute clock skew
      if (payload.exp < now - 300) {
        throw new Error("Token has expired");
      }
    }

    // Validate issued-at time (iat) - token should not be from the future
    if (payload.iat) {
      const now = Math.floor(Date.now() / 1000);
      // Allow 5 minute clock skew
      if (payload.iat > now + 300) {
        throw new Error("Token issued in the future - clock skew too large");
      }
    }

    logger.debug("JWT validation passed", {
      iss: payload.iss,
      sub: payload.sub,
      email: payload.email,
    });

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
   * Generate PKCE code_verifier (RFC 7636)
   * Must be 43-128 characters using [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   */
  private generateCodeVerifier(): string {
    // Generate 32 random bytes (256 bits) and encode as base64url
    // This produces a 43 character string
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate PKCE code_challenge from code_verifier using SHA-256 (RFC 7636)
   * code_challenge = BASE64URL(SHA256(code_verifier))
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    // Encode the code_verifier as UTF-8
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);

    // Compute SHA-256 hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    // Convert to base64url
    return this.base64UrlEncode(new Uint8Array(hashBuffer));
  }

  /**
   * Base64URL encode a Uint8Array (RFC 4648 Section 5)
   */
  private base64UrlEncode(array: Uint8Array): string {
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...array));
    // Convert to base64url: replace + with -, / with _, remove padding =
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    const isValid = this.session !== null &&
                    (!this.session.expiresAt || this.session.expiresAt > Date.now());

    return {
      enabled: this.config !== null,
      provider: this.config?.provider,
      isAuthenticated: Boolean(isValid),
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
