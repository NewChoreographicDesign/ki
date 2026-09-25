import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { encryptSensitiveField } from "@/lib/field-encryption";
import { generateMfaSecret, buildOtpauthUri, renderOtpauthQrDataUrl } from "@/lib/mfa";

// Starts (or restarts) enrollment: generates a fresh secret and stores it
// encrypted, but mfaEnabled stays false until POST .../confirm verifies a
// real code from it — so an abandoned setup (closed tab, never scanned
// the QR) can never leave an account half-protected. Calling this again
// before confirming simply overwrites the not-yet-active secret with a
// new one, which is fine: nothing depended on the old one yet.
export async function POST() {
  try {
    const session = await requireAuth();

    const user = await db.user.findUnique({ where: { id: session.sub }, select: { name: true, mfaEnabled: true } });
    if (!user) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }
    if (user.mfaEnabled) {
      return NextResponse.json({ error: "Tweestapsverificatie staat al aan — zet eerst uit om opnieuw in te stellen." }, { status: 409 });
    }

    const orgName = (await db.setting.findUnique({ where: { key: "ORG_NAME" } }))?.value ?? "Woongroep";

    const secret = generateMfaSecret();
    await db.user.update({ where: { id: session.sub }, data: { mfaSecretEncrypted: encryptSensitiveField(secret) } });

    const otpauthUri = buildOtpauthUri({
      secretBase32: secret,
      accountLabel: `${user.name} (${orgName})`,
      issuer: orgName,
    });
    const qrDataUrl = await renderOtpauthQrDataUrl(otpauthUri);

    return NextResponse.json({ secret, otpauthUri, qrDataUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
