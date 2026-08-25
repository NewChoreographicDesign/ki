import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { medicationCheckSchema } from "@/lib/validations";

// Intentionally no PUT/DELETE: medication checks are an irreversible audit log.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { medicationId, comment } = medicationCheckSchema.parse(body);

    const medication = await db.medication.findUnique({ where: { id: medicationId } });
    if (!medication) {
      return NextResponse.json({ error: "Medicatie niet gevonden" }, { status: 404 });
    }

    const check = await db.medicationCheck.create({
      data: { medicationId, userId: session.sub, comment: comment || null },
    });

    return NextResponse.json({ ok: true, check });
  } catch (error) {
    return handleApiError(error);
  }
}
