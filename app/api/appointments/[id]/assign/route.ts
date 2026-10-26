import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentAssignSchema } from "@/lib/validations";
import { AgendaTakeoverError, assignAppointment } from "@/lib/agenda";

// "Ik ga mee": one begeleider per afspraak. Taking over from a colleague asks
// for an explicit `takeover` (409 with the name until then).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = appointmentAssignSchema.parse(await request.json());
    try {
      const appointment = await assignAppointment(session, id, data);
      return NextResponse.json({ ok: true, appointment }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof AgendaTakeoverError) return NextResponse.json({ error: error.message, takeover: true, assigneeName: error.assigneeName }, { status: 409 });
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
