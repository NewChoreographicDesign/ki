import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError, canAccessPersonalTodoAssignment } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";
import { formatDaysOfWeek, parseDDMMYYYY } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const data = todoSchema.parse(body);

    const assignedToId = data.assignedToId || null;
    // Anyone can create a personal task for themselves; assigning one to a
    // DIFFERENT medewerker (the Backend "push a task to someone" flow) is
    // admin/coordinator-only — matches canAccessPersonalTodoAssignment, the
    // same check /persoonlijke-taken itself redirects non-admin/coordinator
    // away for, so this can't be reached by calling the API directly
    // either. Leaving assignedToId empty keeps today's behavior of a
    // shared team task on the Werklijst, unchanged.
    if (assignedToId && assignedToId !== session.sub && !canAccessPersonalTodoAssignment(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }
    if (assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId }, select: { active: true } });
      if (!assignee || !assignee.active) {
        return NextResponse.json({ error: "Medewerker niet gevonden" }, { status: 400 });
      }
    }

    // A task uses either daysOfWeek or the interval pattern, never both —
    // todoSchema only checks an interval has its own anchor, so enforce the
    // "not both" half here rather than trusting the client to have cleared
    // the other one.
    const intervalDays = data.intervalDays ?? null;
    const daysOfWeek = intervalDays ? [] : data.daysOfWeek ?? [];

    const todo = await db.todo.create({
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        daysOfWeek: formatDaysOfWeek(daysOfWeek),
        intervalDays,
        intervalAnchorDate: intervalDays && data.intervalAnchorDate ? parseDDMMYYYY(data.intervalAnchorDate) : null,
        showUntil: data.showUntil ? parseDDMMYYYY(data.showUntil) : null,
        time: data.time || null,
        recurring: data.recurring ?? false,
        createdById: session.sub,
        assignedToId,
        room: data.room || null,
      },
      include: { createdBy: true, completedBy: true, assignedTo: true },
    });

    return NextResponse.json({ ok: true, todo });
  } catch (error) {
    return handleApiError(error);
  }
}
