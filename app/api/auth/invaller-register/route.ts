import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { invallerRegisterSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { createSessionCookie, startShiftForLogin } from "@/lib/auth";
import { verifySecretCode } from "@/lib/passcode";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/api";

// Self-service account creation for a flexwerker — see
// app/invaller-registratie and InvallerRegistration's schema.prisma
// comment. Unlike /api/setup's one-time link, this code is reusable: many
// different flexwerkers can use the same code over time until an admin
// rotates or disables it.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = invallerRegisterSchema.parse(body);

    const registration = await db.invallerRegistration.findUnique({ where: { id: "singleton" } });
    if (!registration?.enabled || !registration.codeHash || !registration.codeSalt) {
      return NextResponse.json({ error: "Invaller-registratie staat momenteel niet open" }, { status: 403 });
    }

    const codeMatches = await verifySecretCode(data.code, registration.codeHash, registration.codeSalt);
    if (!codeMatches) {
      return NextResponse.json({ error: "Onjuiste registratiecode" }, { status: 401 });
    }

    const birthDate = parseDDMMYYYY(data.birthDate);
    if (!birthDate) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { name: data.name } });
    if (existing) {
      return NextResponse.json({ error: "Er bestaat al een gebruiker met deze naam" }, { status: 409 });
    }

    const user = await db.user.create({
      data: { name: data.name, birthDate, role: Role.INVALLER, uitzendbureau: data.uitzendbureau },
    });

    await logAudit({ userId: user.id, action: "invaller.self_register", targetType: "User", targetId: user.id });

    await createSessionCookie({ sub: user.id, name: user.name, role: user.role });
    await startShiftForLogin(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
