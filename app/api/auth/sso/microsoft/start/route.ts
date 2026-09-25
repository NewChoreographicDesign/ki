import { NextRequest, NextResponse } from "next/server";
import {
  isMicrosoftSsoConfigured,
  buildMicrosoftAuthorizeUrl,
  generateOAuthState,
  generatePkceVerifier,
  pkceChallengeFromVerifier,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
} from "@/lib/microsoft-sso";

export async function GET(request: NextRequest) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!isMicrosoftSsoConfigured() || !clientId) {
    return NextResponse.redirect(new URL("/login?error=sso-not-configured", request.url));
  }

  const state = generateOAuthState();
  const verifier = generatePkceVerifier();
  const redirectUri = new URL("/api/auth/sso/microsoft/callback", request.url).toString();

  const authorizeUrl = buildMicrosoftAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: pkceChallengeFromVerifier(verifier),
  });

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  response.cookies.set(SSO_STATE_COOKIE, state, cookieOpts);
  response.cookies.set(SSO_VERIFIER_COOKIE, verifier, cookieOpts);
  return response;
}
