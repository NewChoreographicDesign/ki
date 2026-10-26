import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSnoozeSchema } from "@/lib/validations";
import { snoozeTodo, toTodoData } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { until } = todoSnoozeSchema.parse(await request.json());
    const todo = await snoozeTodo(session, id, until);
    return NextResponse.json({ ok: true, todo: toTodoData(todo) }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
