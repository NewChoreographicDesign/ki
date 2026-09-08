import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

// Admin-only, per the feature request — unlike protocollen (admin or
// coordinator), an overdracht note is explicitly scoped to admins.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;

    const existing = await db.handover.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Overdracht niet gevonden" }, { status: 404 });
    }

    await db.handover.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "handover.delete", targetType: "Handover", targetId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
