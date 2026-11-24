import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { allowanceActionSchema } from "@/lib/validations";
import { applyAllowanceAction } from "@/lib/allowances";

// start / pause / resume / complete / extend — one action per call.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const { action } = allowanceActionSchema.parse(await request.json());
    const allowance = await applyAllowanceAction(id, action);
    return NextResponse.json({ ok: true, allowance }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
