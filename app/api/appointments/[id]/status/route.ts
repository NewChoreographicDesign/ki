import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentStatusSchema } from "@/lib/validations";
import { setStatus } from "@/lib/agenda";

// Afronden (with an optional result), annuleren (with an optional reason; for a
// repeated afspraak this/following/all) and heropenen.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = appointmentStatusSchema.parse(await request.json());
    const updated = await setStatus(session, id, data.status, data.note || null, data.scope ?? "this");
    return NextResponse.json({ ok: true, updated: updated.length, appointment: updated.find((a) => a.id === id) ?? updated[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
