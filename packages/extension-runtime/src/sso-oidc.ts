import type { JWTClaims, OIDCConfig, SSOLogger, SSOSession, SSOProvider, TokenResponse } from "./sso-types.js";
import { decodeJwtPayload, validateJwtClaims } from "./sso-utils.js";

export function buildOidcAuthorizeUrl(
  config: OIDCConfig,
  redirectUri: string,
  options: { state: string; nonce: string; codeChallenge: string }
): URL {
  const authUrl = new URL(`${config.authority}/authorize`);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scope || "openid profile email");
  authUrl.searchParams.set("state", options.state);
  authUrl.searchParams.set("nonce", options.nonce);
  authUrl.searchParams.set("code_challenge", options.codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  return authUrl;
}

export async function exchangeCodeForTokens(
  config: OIDCConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
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

export function decodeAndValidateJWT(
  token: string,
  options: {
    expectedNonce?: string;
    expectedIssuer?: string;
    expectedAudience?: string;
    logger?: SSOLogger;
  }
): JWTClaims {
  const claims = decodeJwtPayload(token);
  const error = validateJwtClaims(claims, {
    expectedNonce: options.expectedNonce,
    expectedIssuer: options.expectedIssuer,
    expectedAudience: options.expectedAudience,
  });

  if (error) {
    throw new Error(error);
  }

  options.logger?.debug?.("JWT validation passed", {
    iss: claims.iss,
    sub: claims.sub,
    email: claims.email,
  });

  return claims;
}

export function createSessionFromTokens(
  tokens: TokenResponse,
  provider: SSOProvider,
  options: {
    expectedNonce?: string;
    expectedIssuer?: string;
    expectedAudience?: string;
    logger?: SSOLogger;
  }
): SSOSession {
  const session: SSOSession = {
    provider,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresAt: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined,
  };

  if (tokens.id_token) {
    try {
      const claims = decodeAndValidateJWT(tokens.id_token, {
        expectedNonce: options.expectedNonce,
        expectedIssuer: options.expectedIssuer,
        expectedAudience: options.expectedAudience,
        logger: options.logger,
      });
      session.userId = claims.sub;
      session.userEmail = claims.email;
      if (claims.exp) {
        session.expiresAt = claims.exp * 1000;
      }
    } catch (error) {
      options.logger?.warn?.("Failed to decode/validate ID token:", error);
      if (provider === "oidc" && options.expectedNonce) {
        throw new Error(`ID token validation failed: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
  }

  return session;
}
