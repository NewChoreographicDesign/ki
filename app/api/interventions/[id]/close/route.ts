import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

// Marks an intervention AFGEROND (finished) — the only status change this
// app allows; there's no route back to OPEN, so closing is a deliberate,
// final action. Still never deletes the row (see the model comment).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const intervention = await db.intervention.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!intervention) {
      return NextResponse.json({ error: "Interventie niet gevonden" }, { status: 404 });
    }
    if (intervention.status === "AFGEROND") {
      return NextResponse.json({ error: "Deze interventie is al afgerond" }, { status: 400 });
    }

    const updated = await db.intervention.update({
      where: { id },
      data: { status: "AFGEROND", closedAt: new Date(), closedById: session.sub },
    });

    await logAudit({
      userId: session.sub,
      action: "intervention.close",
      targetType: "Intervention",
      targetId: id,
    });

    return NextResponse.json({ ok: true, intervention: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
