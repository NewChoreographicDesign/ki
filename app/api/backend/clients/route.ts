import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { clientSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    await requireAuth([Role.ADMIN]);
    const body = await request.json();
    const data = clientSchema.parse(body);

    const client = await db.client.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? parseDDMMYYYY(data.dateOfBirth) : null,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ ok: true, client });
  } catch (error) {
    return handleApiError(error);
  }
}
