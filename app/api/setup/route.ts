import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { setupSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { createSessionCookie, startShiftForLogin } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  const existingUsers = await db.user.count();
  return NextResponse.json({ setupNeeded: existingUsers === 0 });
}

// Creates the very first admin account, once. Refuses to run again the
// moment any user exists, so this can never be used to plant a second
// account on a live installation.
export async function POST(request: NextRequest) {
  try {
    const existingUsers = await db.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({ error: "Setup is al voltooid" }, { status: 409 });
    }

    const body = await request.json();
    const data = setupSchema.parse(body);

    const birthDate = parseDDMMYYYY(data.birthDate);
    if (!birthDate) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const user = await db.user.create({
      data: { name: data.name, birthDate, role: Role.ADMIN },
    });

    await db.setting.createMany({
      data: [
        { key: "GENERAL_EMAIL", value: data.generalEmail },
        { key: "COORDINATOR_EMAIL", value: data.coordinatorEmail },
        { key: "ORG_NAME", value: "Woongroep" },
      ],
    });

    await createSessionCookie({ sub: user.id, name: user.name, role: user.role });
    await startShiftForLogin(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
