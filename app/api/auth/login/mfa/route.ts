import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionCookie, startShiftForLogin } from "@/lib/auth";
import { verifyMfaPendingToken, MFA_PENDING_COOKIE } from "@/lib/mfa-pending";
import { decryptSensitiveField } from "@/lib/field-encryption";
import { verifyTotpCode, verifyBackupCode, looksLikeBackupCode } from "@/lib/mfa";
import { mfaVerifySchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

// Same brute-force throttle as a wrong birthdate (see app/api/auth/login),
// reusing the exact same failedLoginAttempts/lockedUntil counter — a wrong
// code here locks the account exactly like repeated wrong birthdates
// would, so an attacker who somehow guessed the birthdate gains nothing.
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

// The second step of login for an account with MFA enabled — completes
// what app/api/auth/login/route.ts started.
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const pending = await verifyMfaPendingToken(cookieStore.get(MFA_PENDING_COOKIE)?.value);
    if (!pending) {
      return NextResponse.json({ error: "Sessie verlopen — log opnieuw in." }, { status: 401 });
    }

    const { code } = mfaVerifySchema.parse(await request.json());

    const user = await db.user.findUnique({ where: { id: pending.sub } });
    if (!user || !user.active || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      return NextResponse.json({ error: "Sessie verlopen — log opnieuw in." }, { status: 401 });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw." },
        { status: 429 }
      );
    }

    let valid = false;
    let usedBackupCodeId: string | null = null;

    if (looksLikeBackupCode(code)) {
      const unusedCodes = await db.mfaBackupCode.findMany({ where: { userId: user.id, usedAt: null } });
      for (const backupCode of unusedCodes) {
        if (await verifyBackupCode(code, backupCode.codeHash, backupCode.codeSalt)) {
          valid = true;
          usedBackupCodeId = backupCode.id;
          break;
        }
      }
    } else {
      const secret = decryptSensitiveField(user.mfaSecretEncrypted);
      valid = Boolean(secret) && verifyTotpCode(secret!, code);
    }

    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts >= MAX_ATTEMPTS ? 0 : attempts,
          lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null,
        },
      });
      await logAudit({ userId: user.id, action: "login.mfa.failed" });
      return NextResponse.json({ error: "Ongeldige code" }, { status: 401 });
    }

    if (usedBackupCodeId) {
      await db.mfaBackupCode.update({ where: { id: usedBackupCodeId }, data: { usedAt: new Date() } });
      await logAudit({ userId: user.id, action: "login.mfa.backup-code-used", targetType: "MfaBackupCode", targetId: usedBackupCodeId });
    }

    await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    await createSessionCookie({ sub: user.id, name: user.name, role: user.role });
    const shift = await startShiftForLogin(user.id);
    await logAudit({ userId: user.id, action: "login.success" });

    const response = NextResponse.json({ ok: true, role: user.role, shift: shift.type });
    response.cookies.delete(MFA_PENDING_COOKIE);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
