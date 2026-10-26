import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { handoverAckAllSchema } from "@/lib/validations";
import { handoverVisibleWhere } from "@/lib/handover";

// "Alles gelezen": marks every currently visible note (or the given subset) as read.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { ids } = handoverAckAllSchema.parse(await request.json().catch(() => ({})));

    const notes = await db.handover.findMany({
      where: { AND: [handoverVisibleWhere(), ids ? { id: { in: ids } } : {}], userId: { not: session.sub }, acks: { none: { userId: session.sub } } },
      select: { id: true },
    });
    if (notes.length > 0) {
      await db.handoverAck.createMany({ data: notes.map((n) => ({ handoverId: n.id, userId: session.sub })) });
      await logAudit({ userId: session.sub, action: "handover.ack_all", targetType: "Handover" });
    }
    return NextResponse.json({ ok: true, acknowledged: notes.length });
  } catch (error) {
    return handleApiError(error);
  }
}
