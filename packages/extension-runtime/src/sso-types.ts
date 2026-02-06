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

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface JWTClaims {
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
  expiresInSeconds?: number;
}

export interface SSOLogger {
  info?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}
