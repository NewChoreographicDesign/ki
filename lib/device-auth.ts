import { jwtVerify, SignJWT } from "jose";

// Deliberately NOT "server-only": this runs from middleware.ts too, which
// executes on the Edge runtime — no Prisma/DB access there, only jose +
// Web Crypto, both Edge-compatible (Buffer is already used the same way for
// the CSP nonce in middleware.ts, confirmed working in production).

export const DEVICE_TOKEN_COOKIE = "device_token";

export function isDeviceRestrictionEnabled(): boolean {
  return process.env.DEVICE_RESTRICTION_ENABLED === "true";
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

/**
 * A hash of the current DEVICE_PASSCODE, embedded in every issued device
 * token and re-checked on every verification. This makes rotating
 * DEVICE_PASSCODE (a plain env var change + redeploy) an immediate
 * "revoke every enrolled device at once" lever — the only revocation
 * granularity this needs, since there's no per-device registry to manage.
 */
async function passcodeFingerprint(): Promise<string> {
  const passcode = process.env.DEVICE_PASSCODE ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passcode));
  return Buffer.from(digest).toString("hex");
}

export async function signDeviceToken(): Promise<string> {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error("JWT_SECRET ontbreekt");
  const fp = await passcodeFingerprint();
  return new SignJWT({ device: true, fp })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    // Long-lived on purpose: this marks "this iPad is enrolled", not a user
    // session (that's the separate 12h session cookie on top of this).
    .setExpirationTime("10y")
    .sign(secretKey);
}

export async function verifyDeviceToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secretKey = getSecretKey();
  if (!secretKey) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.device !== true || typeof payload.fp !== "string") return false;
    return payload.fp === (await passcodeFingerprint());
  } catch {
    return false;
  }
}
