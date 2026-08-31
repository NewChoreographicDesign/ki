import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Role, ShiftType } from "@prisma/client";
import { db } from "@/lib/db";
import { determineShiftType, shiftEndForStart } from "@/lib/utils";

export { determineShiftType, shiftEndForStart };

const COOKIE_NAME = "session";
const SESSION_DURATION_SECONDS = 12 * 60 * 60; // 12 hours

// Never let this ship: it's the literal value from .env.example, so a
// deployment that copied the example file without generating a real
// secret would otherwise sign tokens anyone could forge.
const PLACEHOLDER_JWT_SECRET = "change-me-to-a-long-random-string-min-32-chars";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  if (secret === PLACEHOLDER_JWT_SECRET) {
    throw new Error("JWT_SECRET is still the placeholder from .env.example — generate a real secret");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  name: string;
  role: Role;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || typeof payload.name !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return { sub: payload.sub, name: payload.name, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Verifies the cookie AND re-checks the user's current active/role state in
 * the database. The JWT is valid for 12 hours, but a deactivation or role
 * change (e.g. an admin revoking a departing employee, or demoting someone)
 * must take effect immediately — not whenever that token happens to expire.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySession(token);
  if (!claims) return null;

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: { name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;

  return { sub: claims.sub, name: user.name, role: user.role };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Use inside API routes / server actions. Throws AuthError when unauthenticated or unauthorized. */
export async function requireAuth(roles?: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError("Niet ingelogd", 401);
  if (roles && !roles.includes(session.role)) {
    throw new AuthError("Geen toegang", 403);
  }
  return session;
}

export function canAccessBackend(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canAccessWeeklyReport(role: Role): boolean {
  return role === Role.ADMIN || role === Role.COORDINATOR;
}

/** Ends any dangling open shift for the user and starts a fresh one for the current login. */
export async function startShiftForLogin(userId: string): Promise<{ id: string; type: ShiftType }> {
  const now = new Date();
  const type = determineShiftType(now);

  await db.shift.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: now },
  });

  const shift = await db.shift.create({
    data: { userId, type, startedAt: now },
  });

  return { id: shift.id, type: shift.type };
}
