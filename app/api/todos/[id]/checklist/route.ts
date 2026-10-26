import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoChecklistSchema } from "@/lib/validations";
import { toggleChecklistItem, toTodoData } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { itemId, done } = todoChecklistSchema.parse(await request.json());
    const todo = await toggleChecklistItem(session, id, itemId, done);
    return NextResponse.json({ ok: true, todo: toTodoData(todo) }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
