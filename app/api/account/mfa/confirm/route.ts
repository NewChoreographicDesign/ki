import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { decryptSensitiveField } from "@/lib/field-encryption";
import { verifyTotpCode, generateBackupCodes, hashBackupCode } from "@/lib/mfa";
import { mfaConfirmSchema } from "@/lib/validations";

// The one required step between "generated a secret" and "MFA is actually
// protecting this account": proves the person setting this up can produce
// a real code from it (i.e. they actually scanned/entered it into a real
// authenticator), not just that a secret exists in the database. Only on
// success does mfaEnabled flip to true and backup codes get minted — shown
// in the response exactly once; only their scrypt hash is ever stored.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { code } = mfaConfirmSchema.parse(await request.json());

    const user = await db.user.findUnique({ where: { id: session.sub } });
    if (!user?.mfaSecretEncrypted) {
      return NextResponse.json({ error: "Start eerst het instellen van tweestapsverificatie." }, { status: 409 });
    }
    if (user.mfaEnabled) {
      return NextResponse.json({ error: "Tweestapsverificatie staat al aan." }, { status: 409 });
    }

    const secret = decryptSensitiveField(user.mfaSecretEncrypted);
    if (!secret || !verifyTotpCode(secret, code)) {
      return NextResponse.json({ error: "Ongeldige code — probeer opnieuw." }, { status: 400 });
    }

    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(backupCodes.map((c) => hashBackupCode(c)));

    await db.user.update({
      where: { id: session.sub },
      data: { mfaEnabled: true, mfaEnrolledAt: new Date() },
    });
    await db.mfaBackupCode.createMany({
      data: hashed.map(({ hash, salt }) => ({ userId: session.sub, codeHash: hash, codeSalt: salt })),
    });
    await logAudit({ userId: session.sub, action: "user.mfa.enabled", targetType: "User", targetId: session.sub });

    return NextResponse.json({ ok: true, backupCodes });
  } catch (error) {
    return handleApiError(error);
  }
}
