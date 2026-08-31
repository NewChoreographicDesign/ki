import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { userSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const body = await request.json();
    const data = userSchema.parse(body);

    const birthDate = parseDDMMYYYY(data.birthDate);
    if (!birthDate) {
      return NextResponse.json({ error: "Ongeldige geboortedatum" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { name: data.name } });
    if (existing) {
      return NextResponse.json({ error: "Er bestaat al een gebruiker met deze naam" }, { status: 409 });
    }

    const user = await db.user.create({
      data: { name: data.name, birthDate, role: data.role },
    });
    await logAudit({ userId: session.sub, action: "user.create", targetType: "User", targetId: user.id });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
