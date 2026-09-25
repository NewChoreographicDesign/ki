import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * The short-lived bridge between "naam+geboortedatum checked out" and "MFA
 * code checked out" in app/api/auth/login/route.ts +
 * app/api/auth/login/mfa/route.ts — deliberately NOT the real session
 * cookie: creating a full session before the second factor is verified
 * would make MFA decorative. A small signed JWT in an httpOnly cookie,
 * same shape as the session cookie, but with a 5-minute expiry — long
 * enough to type a 6-digit code, short enough that an abandoned first
 * step can't be resumed later.
 */
export const MFA_PENDING_COOKIE = "mfa_pending";
const PENDING_TTL_SECONDS = 5 * 60;

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET ontbreekt");
  return new TextEncoder().encode(secret);
}

export type MfaPendingClaims = { sub: string };

export async function signMfaPendingToken(claims: MfaPendingClaims): Promise<string> {
  return new SignJWT({ mfaPending: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyMfaPendingToken(token: string | undefined): Promise<MfaPendingClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.mfaPending !== true || !payload.sub) return null;
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}
