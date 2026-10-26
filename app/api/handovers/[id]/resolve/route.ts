import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { handoverResolveSchema } from "@/lib/validations";

// Closing the loop on a note that needed an action. Open to everybody (whoever
// does the follow-up should be able to tick it off); the audit trail records who did.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { resolved, note } = handoverResolveSchema.parse(await request.json());

    const existing = await db.handover.findUnique({ where: { id }, select: { id: true, needsAction: true } });
    if (!existing) return NextResponse.json({ error: "Overdracht niet gevonden" }, { status: 404 });
    if (!existing.needsAction) return NextResponse.json({ error: "Bij deze notitie hoort geen actie" }, { status: 400 });

    await db.handover.update({
      where: { id },
      data: resolved
        ? { resolvedAt: new Date(), resolvedById: session.sub, resolutionNote: note || null }
        : { resolvedAt: null, resolvedById: null, resolutionNote: null },
    });
    await logAudit({ userId: session.sub, action: resolved ? "handover.resolve" : "handover.reopen", targetType: "Handover", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
