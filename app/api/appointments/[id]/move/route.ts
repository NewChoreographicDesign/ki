import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentMoveSchema } from "@/lib/validations";
import { moveAppointment } from "@/lib/agenda";

// Drag-and-drop in the calendar: only the time changes, one afspraak.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = appointmentMoveSchema.parse(await request.json());
    const appointment = await moveAppointment(session, id, data);
    return NextResponse.json({ ok: true, appointment }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
