import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { todoBulkSchema } from "@/lib/validations";
import { bulkTodos } from "@/lib/todos";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { action, ids, until } = todoBulkSchema.parse(await request.json());
    const changed = await bulkTodos(session, action, ids, until);
    return NextResponse.json({ ok: true, ids: changed }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
