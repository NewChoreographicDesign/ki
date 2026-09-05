import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const data = todoSchema.parse(body);

    const todo = await db.todo.create({
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        dayOfWeek: data.dayOfWeek ?? null,
        recurring: data.recurring ?? false,
        createdById: session.sub,
      },
    });

    return NextResponse.json({ ok: true, todo });
  } catch (error) {
    return handleApiError(error);
  }
}
