import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { mfaDisableSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";

// Current MFA status for the Mijn-account panel — never returns the
// secret or any backup code, only whether it's on.
export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: { mfaEnabled: true, mfaEnrolledAt: true },
    });
    const remainingBackupCodes = user?.mfaEnabled
      ? await db.mfaBackupCode.count({ where: { userId: session.sub, usedAt: null } })
      : 0;
    return NextResponse.json({
      enabled: user?.mfaEnabled ?? false,
      enrolledAt: user?.mfaEnrolledAt?.toISOString() ?? null,
      remainingBackupCodes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Turns MFA off — requires the account's own birthdate as step-up
// confirmation (a valid session cookie on a shared device doesn't prove
// who's actually at the keyboard). Clears the secret and every backup
// code; re-enrolling starts completely fresh.
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { birthDate } = mfaDisableSchema.parse(await request.json());
    const parsed = parseDDMMYYYY(birthDate);
    if (!parsed) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.sub } });
    if (!user || user.birthDate.getTime() !== parsed.getTime()) {
      return NextResponse.json({ error: "Geboortedatum is onjuist" }, { status: 401 });
    }
    if (!user.mfaEnabled) {
      return NextResponse.json({ ok: true });
    }

    await db.user.update({
      where: { id: session.sub },
      data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaEnrolledAt: null },
    });
    await db.mfaBackupCode.deleteMany({ where: { userId: session.sub } });
    await logAudit({ userId: session.sub, action: "user.mfa.disabled", targetType: "User", targetId: session.sub });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
