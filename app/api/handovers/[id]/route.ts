import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { handoverUpdateSchema } from "@/lib/validations";
import { canEditHandover } from "@/lib/handover-shared";

// A note can be corrected or withdrawn by its author for 24 hours (a wrong
// client, a typo, something that shouldn't have been written down) and by
// an admin at any time — widened from the previous admin-only rule so a
// mistake can be fixed quickly by whoever made it.
async function loadEditable(userId: string, isAdmin: boolean, id: string) {
  const existing = await db.handover.findUnique({ where: { id }, select: { id: true, userId: true, createdAt: true, needsAction: true } });
  if (!existing) return { ok: false as const, response: NextResponse.json({ error: "Overdracht niet gevonden" }, { status: 404 }) };
  if (!canEditHandover(existing, { userId, isAdmin })) {
    return { ok: false as const, response: NextResponse.json({ error: "Je kunt deze overdracht niet meer wijzigen" }, { status: 403 }) };
  }
  return { ok: true as const, existing };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const loaded = await loadEditable(session.sub, session.role === "ADMIN", id);
    if (!loaded.ok) return loaded.response;
    const { existing } = loaded;
    const patch = handoverUpdateSchema.parse(await request.json());

    const data: Record<string, unknown> = { editedAt: new Date(), editedById: session.sub };
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.category) data.category = patch.category;
    if (patch.priority) data.priority = patch.priority;
    if (patch.needsAction !== undefined) {
      data.needsAction = patch.needsAction;
      // Dropping the action also drops any earlier resolution.
      if (!patch.needsAction) Object.assign(data, { resolvedAt: null, resolvedById: null, resolutionNote: null });
    }
    await db.handover.update({ where: { id }, data });

    // A material change (text, priority, action) must be read again: reset the
    // read receipts of everybody but the person who edited.
    const material = patch.content !== undefined || patch.priority !== undefined || (patch.needsAction !== undefined && patch.needsAction !== existing.needsAction);
    if (material) await db.handoverAck.deleteMany({ where: { handoverId: id, userId: { not: session.sub } } });

    await logAudit({ userId: session.sub, action: "handover.update", targetType: "Handover", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const loaded = await loadEditable(session.sub, session.role === "ADMIN", id);
    if (!loaded.ok) return loaded.response;

    await db.handover.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "handover.delete", targetType: "Handover", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
