import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { medicationSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const body = await request.json();
    const data = medicationSchema.parse(body);

    const medication = await db.medication.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        dosage: data.dosage,
        instructions: data.instructions || null,
        times: data.times,
      },
    });

    return NextResponse.json({ ok: true, medication });
  } catch (error) {
    return handleApiError(error);
  }
}
