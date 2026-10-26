import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoCommentSchema } from "@/lib/validations";
import { commentOnTodo, loadTodoEvents } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const events = await loadTodoEvents(session, id);
    return NextResponse.json({ ok: true, events }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { comment } = todoCommentSchema.parse(await request.json());
    await commentOnTodo(session, id, comment);
    const events = await loadTodoEvents(session, id);
    return NextResponse.json({ ok: true, events }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
