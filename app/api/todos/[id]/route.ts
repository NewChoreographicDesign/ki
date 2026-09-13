import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";
import { formatDaysOfWeek } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// Editing/deleting someone else's SHARED task is admin-only (anyone can
// create and complete one, but changing or removing one another medewerker
// made is an administrative action) — matches how protocol deletion is
// scoped. A PERSONAL task (assignedToId set) is also manageable by the
// medewerker it belongs to, and by admin/coordinator (who can assign one in
// the first place via Backend) — not by other medewerkers.
function canManageTodo(session: { sub: string; role: Role }, todo: { assignedToId: string | null }): boolean {
  if (todo.assignedToId) {
    return todo.assignedToId === session.sub || session.role === Role.ADMIN || session.role === Role.COORDINATOR;
  }
  return session.role === Role.ADMIN;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = todoSchema.parse(body);

    const existing = await db.todo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
    }
    if (!canManageTodo(session, existing)) {
      throw new AuthError("Geen toegang", 403);
    }

    const todo = await db.todo.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        daysOfWeek: formatDaysOfWeek(data.daysOfWeek ?? []),
        time: data.time || null,
        recurring: data.recurring ?? false,
        // Reassigning to someone else isn't supported here — the assignee
        // stays whatever it was created with, edited only via title/room/etc.
        room: existing.assignedToId ? data.room || null : undefined,
      },
      include: { createdBy: true, completedBy: true, assignedTo: true },
    });
    await logAudit({ userId: session.sub, action: "todo.update", targetType: "Todo", targetId: id });

    return NextResponse.json({ ok: true, todo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await db.todo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
    }
    if (!canManageTodo(session, existing)) {
      throw new AuthError("Geen toegang", 403);
    }

    await db.todo.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "todo.delete", targetType: "Todo", targetId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
