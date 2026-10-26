import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, determineShiftType } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { handoverSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { handoverExpiry, handoverPurgeWhere } from "@/lib/handover";

// Every role can write a note (same openness as before). What's new: a
// category/priority/needsAction, and the write lands in the audit trail.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = handoverSchema.parse(await request.json());

    const clientId = data.clientId || null;
    if (clientId) {
      const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    }

    const now = new Date();
    const handover = await db.handover.create({
      data: {
        userId: session.sub,
        shift: determineShiftType(now),
        content: data.content,
        expiresAt: handoverExpiry(now),
        clientId,
        category: data.category,
        priority: data.priority,
        needsAction: data.needsAction,
      },
      select: { id: true },
    });

    // Sweep expired notes on every write (indexed on expiresAt, best effort).
    await db.handover.deleteMany({ where: handoverPurgeWhere(now) }).catch(() => undefined);

    await logAudit({ userId: session.sub, action: "handover.create", targetType: "Handover", targetId: handover.id });
    return NextResponse.json({ ok: true, id: handover.id });
  } catch (error) {
    return handleApiError(error);
  }
}
