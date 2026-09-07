import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";
import { formatDaysOfWeek } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// Editing/deleting someone else's task is admin-only (anyone can create and
// complete a task, but changing or removing one another medewerker made is
// an administrative action) — matches how protocol deletion is scoped.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;
    const body = await request.json();
    const data = todoSchema.parse(body);

    const existing = await db.todo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
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
      },
      include: { createdBy: true, completedBy: true },
    });
    await logAudit({ userId: session.sub, action: "todo.update", targetType: "Todo", targetId: id });

    return NextResponse.json({ ok: true, todo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;

    const existing = await db.todo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
    }

    await db.todo.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "todo.delete", targetType: "Todo", targetId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
