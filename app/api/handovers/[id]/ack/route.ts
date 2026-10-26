import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

// "Gelezen" receipt for the signed-in medewerker. Idempotent both ways, so a
// double tap or a retried request never errors.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const note = await db.handover.findUnique({ where: { id }, select: { id: true } });
    if (!note) return NextResponse.json({ error: "Overdracht niet gevonden" }, { status: 404 });

    await db.handoverAck.upsert({
      where: { handoverId_userId: { handoverId: id, userId: session.sub } },
      create: { handoverId: id, userId: session.sub },
      update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await db.handoverAck.deleteMany({ where: { handoverId: id, userId: session.sub } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
