import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoSchema } from "@/lib/validations";
import { createTodo, loadTodoBoard, toTodoData, TodoConflictError } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await requireAuth();
    const board = await loadTodoBoard();
    return NextResponse.json({ ok: true, open: board.open, completed: board.completed, serverTime: board.serverTime }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = todoSchema.parse(await request.json());
    const todo = await createTodo(session, data);
    return NextResponse.json({ ok: true, todo: toTodoData(todo) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof TodoConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    return handleApiError(error);
  }
}
