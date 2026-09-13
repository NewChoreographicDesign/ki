import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";
import { formatDaysOfWeek } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const data = todoSchema.parse(body);

    const assignedToId = data.assignedToId || null;
    // Anyone can create a personal task for themselves; assigning one to a
    // DIFFERENT medewerker (the Backend "push a task to someone" flow) is
    // admin/coordinator-only. Leaving assignedToId empty keeps today's
    // behavior of a shared team task on the Werklijst, unchanged.
    if (assignedToId && assignedToId !== session.sub && session.role === Role.EMPLOYEE) {
      throw new AuthError("Geen toegang", 403);
    }
    if (assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId }, select: { active: true } });
      if (!assignee || !assignee.active) {
        return NextResponse.json({ error: "Medewerker niet gevonden" }, { status: 400 });
      }
    }

    const todo = await db.todo.create({
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        daysOfWeek: formatDaysOfWeek(data.daysOfWeek ?? []),
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
