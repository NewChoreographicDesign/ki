import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { allowanceCreateSchema } from "@/lib/validations";
import { createAllowance, loadAllowanceBoard } from "@/lib/allowances";

const NO_STORE = { "Cache-Control": "no-store" };

// Live snapshot for the Toegestane tijd tab — never cached, same reasoning
// as /api/todos: a stale "running" allowance a colleague already paused
// would show the wrong timer.
export async function GET() {
  try {
    await requireAuth();
    const board = await loadAllowanceBoard();
    return NextResponse.json({ ok: true, ...board }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = allowanceCreateSchema.parse(await request.json());
    const allowance = await createAllowance(session, { ...data, note: data.note || undefined });
    return NextResponse.json({ ok: true, allowance }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
