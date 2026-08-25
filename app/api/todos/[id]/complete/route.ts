import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoCompleteSchema } from "@/lib/validations";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { completionNote } = todoCompleteSchema.parse(body);

    const existing = await db.todo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
    }

    const todo = await db.todo.update({
      where: { id },
      data: {
        completed: true,
        completedById: session.sub,
        completedAt: new Date(),
        completionNote: completionNote || null,
      },
    });

    return NextResponse.json({ ok: true, todo });
  } catch (error) {
    return handleApiError(error);
  }
}
