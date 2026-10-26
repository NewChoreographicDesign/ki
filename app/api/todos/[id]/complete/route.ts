import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoCompleteSchema } from "@/lib/validations";
import { completeTodo, reopenTodo, toTodoData } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { completionNote } = todoCompleteSchema.parse(body);
    const todo = await completeTodo(session, id, completionNote || undefined);
    return NextResponse.json({ ok: true, todo: toTodoData(todo) }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

/** "Ongedaan maken" — reopen a just-completed task. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const todo = await reopenTodo(session, id);
    return NextResponse.json({ ok: true, todo: toTodoData(todo) }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
