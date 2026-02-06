import type { JWTClaims } from "./sso-types.js";

const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function base64UrlEncode(array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < array.length; i += 1) {
    binary += String.fromCharCode(array[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

export function decodeJwtPayload(token: string): JWTClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  try {
    const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64Payload));
  } catch {
    throw new Error("Failed to decode JWT payload");
  }
}

export function validateJwtClaims(
  claims: JWTClaims,
  options: {
    expectedNonce?: string;
    expectedIssuer?: string;
    expectedAudience?: string;
    clockSkewSec?: number;
  }
): string | null {
  const now = Math.floor(Date.now() / 1000);
  const clockSkewSec = options.clockSkewSec ?? 300;

  if (claims.exp && claims.exp < now - clockSkewSec) {
    return "Token has expired";
  }

  if (claims.iat && claims.iat > now + clockSkewSec) {
    return "Token issued in the future";
  }

  if (options.expectedNonce && claims.nonce !== options.expectedNonce) {
    return "Nonce mismatch";
  }

  if (options.expectedIssuer && claims.iss) {
    const normalizedExpected = options.expectedIssuer.replace(/\/$/, "");
    const normalizedActual = claims.iss.replace(/\/$/, "");
    if (normalizedActual !== normalizedExpected) {
      return "Invalid issuer";
    }
  }

  if (options.expectedAudience && claims.aud) {
    const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audList.includes(options.expectedAudience)) {
      return "Invalid audience";
    }
  }

  return null;
}

export function decodeSamlResponse(samlResponse: string): string {
  try {
    const base64 = samlResponse.replace(/-/g, "+").replace(/_/g, "/");
    return atob(base64);
  } catch {
    throw new Error("Failed to decode SAML response - invalid base64");
  }
}

export function validateSamlTimestamps(
  notBefore: string | undefined,
  notOnOrAfter: string | undefined,
  now: number = Date.now(),
  clockSkewMs: number = DEFAULT_CLOCK_SKEW_MS
): string | null {
  if (notBefore) {
    const notBeforeTime = new Date(notBefore).getTime();
    if (notBeforeTime > now + clockSkewMs) {
      return "SAML assertion not yet valid";
    }
  }

  if (notOnOrAfter) {
    const notOnOrAfterTime = new Date(notOnOrAfter).getTime();
    if (notOnOrAfterTime < now - clockSkewMs) {
      return "SAML assertion has expired";
    }
  }

  return null;
}

export function extractSamlNameId(decodedResponse: string): string | null {
  const match = decodedResponse.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);
  return match?.[1] ?? null;
}

export function extractSamlEmail(decodedResponse: string): string | null {
  const match = decodedResponse.match(
    /<saml:Attribute Name="email"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i
  );
  return match?.[1] ?? null;
}

export function extractSamlIssuer(decodedResponse: string): string | null {
  const match = decodedResponse.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/i);
  return match?.[1] ?? null;
}
