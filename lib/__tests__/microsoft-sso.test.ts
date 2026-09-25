import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  generatePkceVerifier,
  pkceChallengeFromVerifier,
  generateOAuthState,
  buildMicrosoftAuthorizeUrl,
  isMicrosoftSsoConfigured,
} from "@/lib/microsoft-sso";

describe("generatePkceVerifier / generateOAuthState", () => {
  it("produces sufficiently long, URL-safe, non-repeating values", () => {
    const a = generatePkceVerifier();
    const b = generatePkceVerifier();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // RFC 7636 minimum
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);

    const s1 = generateOAuthState();
    const s2 = generateOAuthState();
    expect(s1).not.toBe(s2);
    expect(s1).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("pkceChallengeFromVerifier", () => {
  it("computes the exact S256 challenge per RFC 7636", () => {
    const verifier = generatePkceVerifier();
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(pkceChallengeFromVerifier(verifier)).toBe(expected);
  });

  it("matches the RFC 7636 worked example", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(pkceChallengeFromVerifier(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("buildMicrosoftAuthorizeUrl", () => {
  it("builds a spec-correct authorize URL against the 'organizations' multi-tenant segment", () => {
    const url = new URL(
      buildMicrosoftAuthorizeUrl({
        clientId: "test-client-id",
        redirectUri: "https://app.example.com/api/auth/sso/microsoft/callback",
        state: "test-state",
        codeChallenge: "test-challenge",
      })
    );
    expect(url.origin).toBe("https://login.microsoftonline.com");
    // "organizations" — not a specific tenant GUID — is the whole point of
    // this being usable without any one customer's Azure cooperation.
    expect(url.pathname).toBe("/organizations/oauth2/v2.0/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/auth/sso/microsoft/callback");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("isMicrosoftSsoConfigured", () => {
  const originalId = process.env.MICROSOFT_CLIENT_ID;
  const originalSecret = process.env.MICROSOFT_CLIENT_SECRET;

  it("is false when either env var is missing, true when both are set", () => {
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    expect(isMicrosoftSsoConfigured()).toBe(false);

    process.env.MICROSOFT_CLIENT_ID = "id";
    expect(isMicrosoftSsoConfigured()).toBe(false);

    process.env.MICROSOFT_CLIENT_SECRET = "secret";
    expect(isMicrosoftSsoConfigured()).toBe(true);

    if (originalId === undefined) delete process.env.MICROSOFT_CLIENT_ID;
    else process.env.MICROSOFT_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.MICROSOFT_CLIENT_SECRET;
    else process.env.MICROSOFT_CLIENT_SECRET = originalSecret;
  });
});
