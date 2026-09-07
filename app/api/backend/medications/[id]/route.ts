import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  dosage: z.string().trim().min(1).max(200).optional(),
  instructions: z.string().trim().max(1000).optional().or(z.literal("")),
  times: z.string().trim().min(1).max(200).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    const medication = await db.medication.update({
      where: { id },
      data: { ...data, instructions: data.instructions === "" ? null : data.instructions },
    });
    await logAudit({ userId: session.sub, action: "medication.update", targetType: "Medication", targetId: id });
    return NextResponse.json({ ok: true, medication });
  } catch (error) {
    return handleApiError(error);
  }
}

// Only safe when nothing depends on this medication yet — a check is an
// irreversible medical record (see MedicationCheck in schema.prisma), and
// deleting the medication would cascade-delete every one of its checks
// along with it. Once it has history, "Deactiveren" (already supported) is
// the only appropriate way to retire it.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;

    const existing = await db.medication.findUnique({
      where: { id },
      select: { _count: { select: { checks: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Medicatie niet gevonden" }, { status: 404 });
    }
    if (existing._count.checks > 0) {
      return NextResponse.json(
        {
          error:
            "Deze medicatie heeft al registraties en kan niet verwijderd worden — gebruik Deactiveren.",
        },
        { status: 409 }
      );
    }

    await db.medication.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "medication.delete", targetType: "Medication", targetId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
