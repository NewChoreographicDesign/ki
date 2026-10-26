import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";
import { deleteTodo, toTodoData, TodoConflictError, updateTodo } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = todoSchema.parse(await request.json());
    const todo = await updateTodo(session, id, data);
    return NextResponse.json({ ok: true, todo: toTodoData(todo) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof TodoConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await deleteTodo(session, id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
