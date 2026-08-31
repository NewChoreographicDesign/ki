import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { clientSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const body = await request.json();
    const data = clientSchema.parse(body);

    const client = await db.client.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? parseDDMMYYYY(data.dateOfBirth) : null,
        room: data.room || null,
        notes: data.notes || null,
      },
    });
    await logAudit({ userId: session.sub, action: "client.create", targetType: "Client", targetId: client.id });

    return NextResponse.json({ ok: true, client });
  } catch (error) {
    return handleApiError(error);
  }
}
