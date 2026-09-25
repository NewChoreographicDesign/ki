import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionCookie, startShiftForLogin } from "@/lib/auth";
import {
  isMicrosoftSsoConfigured,
  exchangeMicrosoftCode,
  verifyMicrosoftIdToken,
  MicrosoftSsoError,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
} from "@/lib/microsoft-sso";
import { logAudit } from "@/lib/audit";

function loginError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}

// Completes the Microsoft sign-in started by ../start/route.ts. Never
// creates a brand new account — only links (first success) or logs into
// an EXISTING, active, non-invaller User row. The Azure tenant that
// issued the token is not restricted (see lib/microsoft-sso.ts's own
// comment on why) — the real access-control boundary is right here: the
// signed-in Microsoft account's email has to match one already on file.
// Account creation stays exactly as controlled as it always was (an
// admin, via Medewerkers, or — for invallers — the separate registration
// code): SSO is a second way to AUTHENTICATE an existing account, never a
// way to provision a new one.
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!isMicrosoftSsoConfigured() || !clientId || !clientSecret) {
      return loginError(request, "sso-not-configured");
    }

    const url = request.nextUrl;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return loginError(request, "sso-missing-params");

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(SSO_STATE_COOKIE)?.value;
    const verifier = cookieStore.get(SSO_VERIFIER_COOKIE)?.value;
    if (!expectedState || !verifier || state !== expectedState) {
      return loginError(request, "sso-state-mismatch");
    }

    const redirectUri = new URL("/api/auth/sso/microsoft/callback", request.url).toString();
    const { idToken } = await exchangeMicrosoftCode({ clientId, clientSecret, code, redirectUri, codeVerifier: verifier });
    const identity = await verifyMicrosoftIdToken({ idToken, clientId });

    let user = await db.user.findFirst({ where: { azureObjectId: identity.oid } });

    if (!user && identity.email) {
      const candidate = await db.user.findFirst({
        where: { active: true, role: { not: Role.INVALLER }, email: identity.email },
      });
      if (candidate) {
        user = await db.user.update({ where: { id: candidate.id }, data: { azureObjectId: identity.oid } });
        await logAudit({ userId: user.id, action: "user.sso.linked", targetType: "User", targetId: user.id });
      }
    }

    if (!user || !user.active || user.role === Role.INVALLER) {
      return loginError(request, "sso-no-matching-account");
    }

    await createSessionCookie({ sub: user.id, name: user.name, role: user.role });
    await startShiftForLogin(user.id);
    await logAudit({ userId: user.id, action: "login.success" });

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.delete(SSO_STATE_COOKIE);
    response.cookies.delete(SSO_VERIFIER_COOKIE);
    return response;
  } catch (error) {
    console.error("[sso] microsoft callback failed", error);
    return loginError(request, error instanceof MicrosoftSsoError ? "sso-invalid-token" : "sso-failed");
  }
}
