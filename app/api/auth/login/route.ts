import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import { createSessionCookie, startShiftForLogin } from "@/lib/auth";
import { parseDDMMYYYY } from "@/lib/utils";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { signMfaPendingToken, MFA_PENDING_COOKIE } from "@/lib/mfa-pending";

// Login has no password, only a name + birth date — a search space small
// enough to brute-force in minutes without a lockout. This guards against
// that: after MAX_ATTEMPTS wrong tries the account is locked for LOCK_MS.
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, birthDate } = loginSchema.parse(body);

    const parsedBirthDate = parseDDMMYYYY(birthDate);
    if (!parsedBirthDate) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { name } });

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw." },
        { status: 429 }
      );
    }

    const valid =
      !!user && user.active && user.birthDate.getTime() === parsedBirthDate.getTime();

    if (!valid) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts >= MAX_ATTEMPTS ? 0 : attempts,
            lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null,
          },
        });
      }
      await logAudit({ userId: user?.id ?? null, action: "login.failed" });
      return NextResponse.json({ error: "Naam of geboortedatum onjuist" }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    // Naam+geboortedatum is only the FIRST factor for an account with MFA
    // enabled — no session is created yet, only a short-lived pending
    // cookie the client exchanges for one via .../login/mfa once the
    // second factor checks out (see lib/mfa-pending.ts for why this can't
    // just be the real session cookie).
    if (user.mfaEnabled) {
      const pendingToken = await signMfaPendingToken({ sub: user.id });
      const response = NextResponse.json({ mfaRequired: true });
      response.cookies.set(MFA_PENDING_COOKIE, pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 5 * 60,
      });
      return response;
    }

    await createSessionCookie({ sub: user.id, name: user.name, role: user.role });
    const shift = await startShiftForLogin(user.id);
    await logAudit({ userId: user.id, action: "login.success" });

    return NextResponse.json({ ok: true, role: user.role, shift: shift.type });
  } catch (error) {
    return handleApiError(error);
  }
}
