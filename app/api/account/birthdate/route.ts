import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { changeBirthDateSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// Any authenticated role can change their own birthdate — it's their login
// credential (this app has no passwords), so there is no separate "backend"
// gate here on purpose. Requires the current value as step-up confirmation:
// requireAuth() only proves there's a valid session cookie, which on a
// shared device could be one a colleague left open, not proof the person at
// the keyboard right now actually knows this account's credential.
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { currentBirthDate, newBirthDate } = changeBirthDateSchema.parse(body);

    const parsedCurrent = parseDDMMYYYY(currentBirthDate);
    const parsedNew = parseDDMMYYYY(newBirthDate);
    if (!parsedCurrent || !parsedNew) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.sub } });
    if (!user || user.birthDate.getTime() !== parsedCurrent.getTime()) {
      return NextResponse.json({ error: "Huidige geboortedatum is onjuist" }, { status: 401 });
    }

    await db.user.update({ where: { id: session.sub }, data: { birthDate: parsedNew } });
    await logAudit({
      userId: session.sub,
      action: "user.change-own-birthdate",
      targetType: "User",
      targetId: session.sub,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
