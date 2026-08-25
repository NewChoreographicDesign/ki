import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import { createSessionCookie, startShiftForLogin } from "@/lib/auth";
import { parseDDMMYYYY } from "@/lib/utils";
import { handleApiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, birthDate } = loginSchema.parse(body);

    const parsedBirthDate = parseDDMMYYYY(birthDate);
    if (!parsedBirthDate) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { name } });

    if (!user || !user.active || user.birthDate.getTime() !== parsedBirthDate.getTime()) {
      return NextResponse.json({ error: "Naam of geboortedatum onjuist" }, { status: 401 });
    }

    await createSessionCookie({ sub: user.id, name: user.name, role: user.role });
    const shift = await startShiftForLogin(user.id);

    return NextResponse.json({ ok: true, role: user.role, shift: shift.type });
  } catch (error) {
    return handleApiError(error);
  }
}
