import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { decryptForDisplay, encryptForDisplay, generateReadableCode, hashSecretCode } from "@/lib/passcode";
import { logAudit } from "@/lib/audit";

// Manages the app's own reusable invaller self-registration code (see
// InvallerRegistration's schema.prisma comment) — admin only, same as the
// rest of Medewerkers.
export async function GET() {
  try {
    await requireAuth([Role.ADMIN]);
    const registration = await db.invallerRegistration.findUnique({ where: { id: "singleton" } });

    const code =
      registration?.enabled && registration.codeEncrypted ? decryptForDisplay(registration.codeEncrypted) : null;

    return NextResponse.json({ enabled: registration?.enabled ?? false, code });
  } catch (error) {
    return handleApiError(error);
  }
}

// Turns registration on (generating a fresh code) or rotates the existing
// one — same "new code invalidates the old one" lever a device passcode
// rotation would use, just self-service rather than platform-operator-only
// (day-to-day HR action, onboarding a new uitzendbureau).
export async function POST() {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const code = generateReadableCode();
    const { hash, salt } = await hashSecretCode(code);

    await db.invallerRegistration.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        enabled: true,
        codeHash: hash,
        codeSalt: salt,
        codeEncrypted: encryptForDisplay(code),
        version: 1,
      },
      update: {
        enabled: true,
        codeHash: hash,
        codeSalt: salt,
        codeEncrypted: encryptForDisplay(code),
        version: { increment: 1 },
      },
    });

    await logAudit({ userId: session.sub, action: "invaller_registration.rotate" });

    return NextResponse.json({ ok: true, code });
  } catch (error) {
    return handleApiError(error);
  }
}

// Turns self-registration off — existing invaller accounts are unaffected
// (they keep working normally), this only stops NEW ones from being
// created until an admin turns it back on with a fresh code.
export async function DELETE() {
  try {
    const session = await requireAuth([Role.ADMIN]);
    await db.invallerRegistration.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", enabled: false },
      update: { enabled: false, codeHash: null, codeSalt: null, codeEncrypted: null },
    });

    await logAudit({ userId: session.sub, action: "invaller_registration.disable" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
