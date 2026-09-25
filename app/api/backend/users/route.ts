import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
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

    const email = data.email || undefined;
    try {
      const user = await db.user.create({
        data: { name: data.name, birthDate, role: data.role, email },
      });
      await logAudit({ userId: session.sub, action: "user.create", targetType: "User", targetId: user.id });
      return NextResponse.json({ ok: true, user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "Dit e-mailadres is al aan een andere medewerker gekoppeld" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
