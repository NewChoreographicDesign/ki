import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { jwtVerify, createRemoteJWKSet } from "jose";

/**
 * Microsoft sign-in — generic edition. Unlike a customer-specific deploy
 * that registers its OWN Azure app inside ONE customer's Azure AD tenant
 * (and needs that customer's IT to hand over a tenant id/client id/
 * secret), this uses a single Azure app registration YOU own
 * (MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET below), configured as
 * "multitenant" and pointed at Microsoft's `organizations` segment — any
 * work/school Microsoft account from any company can complete the OAuth
 * dance, not just one pinned tenant. No customer IT involvement needed to
 * turn this on for a deployment.
 *
 * The actual access control isn't "which Azure tenant issued the token"
 * (there is no one tenant to pin to any more) — it's purely "does the
 * signed-in Microsoft account's email match an existing, active,
 * non-invaller User already in this app" (see the callback route). An
 * allowlist of accounts, not an allowlist of companies.
 *
 * Standard OAuth2 Authorization Code flow + PKCE against Microsoft's v2.0
 * endpoint — no library beyond `jose` (already a dependency, already used
 * for this app's own session/device JWTs), so ID-token verification goes
 * through the same primitives the rest of the app trusts rather than a
 * new dependency.
 */

// Multi-tenant apps authenticate against this fixed segment rather than a
// specific tenant GUID — Microsoft resolves the actual signing tenant
// per-login. "organizations" accepts any work/school account; personal
// Microsoft accounts (outlook.com, etc.) are excluded, since those never
// carry a verified organizational email an admin would have on file.
const MULTI_TENANT_SEGMENT = "organizations";
const AUTHORITY = `https://login.microsoftonline.com/${MULTI_TENANT_SEGMENT}`;

export const SSO_STATE_COOKIE = "sso_state";
export const SSO_VERIFIER_COOKIE = "sso_verifier";

export function isMicrosoftSsoConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

/** Random URL-safe verifier for PKCE (RFC 7636) — 43-128 chars, we use 64 bytes base64url. */
export function generatePkceVerifier(): string {
  return randomBytes(64).toString("base64url");
}

/** S256 code_challenge derived from a verifier, per RFC 7636. */
export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** CSRF-protection state parameter, round-tripped through a short-lived cookie. */
export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildMicrosoftAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(`${AUTHORITY}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Forces the account picker every time rather than silently reusing
  // Microsoft's own browser session — this device may have just been used
  // by a different colleague, so a silent SSO re-auth would risk logging
  // the wrong person in without either of them noticing.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export class MicrosoftSsoError extends Error {}

/** Exchanges an authorization code for an ID token. Throws MicrosoftSsoError on any failure. */
export async function exchangeMicrosoftCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    scope: "openid profile email",
  });

  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new MicrosoftSsoError(`Microsoft token-endpoint gaf ${res.status}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new MicrosoftSsoError("Geen id_token in Microsoft's antwoord");
  }
  return { idToken: data.id_token };
}

export type MicrosoftIdentity = { oid: string; email: string | null; name: string; tenantId: string };

// One JWKS fetcher for the whole multi-tenant app (not per-tenant, since
// there is no longer one fixed tenant) — createRemoteJWKSet caches the key
// set internally and re-fetches only on a signature miss (e.g. Microsoft's
// own key rotation).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function sharedJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${AUTHORITY}/discovery/v2.0/keys`));
  }
  return jwks;
}

/**
 * Verifies an ID token's signature and audience, then extracts the claims
 * this app actually needs. Deliberately does NOT pin the issuer to one
 * tenant (there is no single tenant any more, see this module's own
 * comment) — jose still verifies the issuer is a well-formed
 * `https://login.microsoftonline.com/<tid>/v2.0` for the token's own tid
 * claim, so a token from a different identity provider entirely is still
 * rejected; it just doesn't restrict WHICH Microsoft tenant. The real
 * access-control boundary is the email-allowlist check in the callback
 * route, not the tenant. Throws MicrosoftSsoError on anything that
 * doesn't check out.
 */
export async function verifyMicrosoftIdToken(params: {
  idToken: string;
  clientId: string;
}): Promise<MicrosoftIdentity> {
  try {
    const { payload } = await jwtVerify(params.idToken, sharedJwks(), {
      audience: params.clientId,
    });
    if (typeof payload.oid !== "string" || !payload.oid) {
      throw new MicrosoftSsoError("Token mist een oid-claim");
    }
    if (typeof payload.tid !== "string" || !payload.tid) {
      throw new MicrosoftSsoError("Token mist een tid-claim");
    }
    if (payload.iss !== `https://login.microsoftonline.com/${payload.tid}/v2.0`) {
      throw new MicrosoftSsoError("Token issuer komt niet overeen met de tenant-claim");
    }
    const email =
      typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : typeof payload.email === "string"
          ? payload.email
          : null;
    const name = typeof payload.name === "string" ? payload.name : email || "Onbekend";
    return { oid: payload.oid, email, name, tenantId: payload.tid };
  } catch (error) {
    if (error instanceof MicrosoftSsoError) throw error;
    throw new MicrosoftSsoError(error instanceof Error ? error.message : "Token-verificatie mislukt");
  }
}
