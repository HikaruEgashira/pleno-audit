import type { SAMLConfig, SSOLogger, SSOSession } from "./sso-types.js";
import {
  decodeSamlResponse,
  extractSamlEmail,
  extractSamlIssuer,
  extractSamlNameId,
  generateRandomString,
  validateSamlTimestamps,
} from "./sso-utils.js";

export function buildSamlRequest(
  config: SAMLConfig,
  assertionConsumerServiceURL: string,
  randomString: (length: number) => string = generateRandomString
): string {
  const id = `_${randomString(32)}`;
  const issueInstant = new Date().toISOString();
  const issuer = config.entityId;

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

export function parseSamlResponse(
  samlResponse: string,
  options: {
    config?: SAMLConfig | null;
    now?: number;
    logger?: SSOLogger;
    randomString?: (length: number) => string;
  } = {}
): SSOSession {
  const decoded = decodeSamlResponse(samlResponse);

  if (!decoded.includes("samlp:Response") && !decoded.includes("Response")) {
    throw new Error("Invalid SAML response");
  }

  const statusMatch = decoded.match(/<samlp?:StatusCode[^>]*Value="([^"]+)"/i);
  if (statusMatch) {
    const statusValue = statusMatch[1];
    if (!statusValue.includes("Success")) {
      const messageMatch = decoded.match(/<samlp?:StatusMessage[^>]*>([^<]+)<\/samlp?:StatusMessage>/i);
      const message = messageMatch?.[1] || "Unknown error";
      throw new Error(`SAML authentication failed: ${message} (status: ${statusValue})`);
    }
  }

  const notBeforeMatch = decoded.match(/NotBefore="([^"]+)"/);
  const notOnOrAfterMatch = decoded.match(/NotOnOrAfter="([^"]+)"/);
  const now = options.now ?? Date.now();

  const timestampError = validateSamlTimestamps(
    notBeforeMatch?.[1],
    notOnOrAfterMatch?.[1],
    now
  );

  if (timestampError) {
    throw new Error(timestampError);
  }

  const issuer = extractSamlIssuer(decoded);
  if (issuer && options.config?.issuer && issuer !== options.config.issuer) {
    options.logger?.warn?.(`SAML issuer mismatch: expected ${options.config.issuer}, got ${issuer}`);
  }

  const email = extractSamlEmail(decoded);
  const nameId = extractSamlNameId(decoded);

  if (!nameId && !email) {
    throw new Error("SAML response missing user identifier");
  }

  let expiresAt = now + 8 * 60 * 60 * 1000;
  if (notOnOrAfterMatch) {
    expiresAt = new Date(notOnOrAfterMatch[1]).getTime();
  }

  const session: SSOSession = {
    provider: "saml",
    userId: nameId ?? undefined,
    userEmail: email ?? undefined,
    expiresAt,
    accessToken: (options.randomString ?? generateRandomString)(64),
  };

  options.logger?.debug?.("SAML response validated", {
    userId: session.userId,
    email: session.userEmail,
    expiresAt: new Date(expiresAt).toISOString(),
  });

  return session;
}
