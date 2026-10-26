import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentSchema } from "@/lib/validations";
import { AgendaConflictError, deleteAppointments, loadAppointment, parseScope, toAgendaItem, updateAppointments } from "@/lib/agenda";

const NO_STORE = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    await requireAuth();
    const { id } = await params;
    return NextResponse.json({ appointment: toAgendaItem(await loadAppointment(id)) }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

// Any staff member can correct a planned afspraak (wrong time, client, a
// typo): no admin gate, since mistakes must be fixable by whoever spots them.
// What keeps it safe is accountability — every edit lands in the afspraak's
// event log and the audit log — and conflict detection: a stale edit (a
// colleague changed the content since the editor loaded it) answers 409
// with the current state; the client may resend with `force`.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = appointmentSchema.parse(await request.json());
    try {
      const { updated } = await updateAppointments(session, id, data, { scope: parseScope(data.scope), version: data.version, force: data.force });
      return NextResponse.json({ ok: true, updated: updated.length, appointment: updated.find((a) => a.id === id) ?? updated[0] }, { headers: NO_STORE });
    } catch (error) {
      if (error instanceof AgendaConflictError) {
        return NextResponse.json({ error: error.message, conflict: true, current: error.current }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// Removing an afspraak for good (it erases its history) is for its maker and
// for supervisors; everybody else cancels it (POST .../status). For a repeated
// afspraak `?scope=this|following|all` picks how much of the series goes.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const deleted = await deleteAppointments(session, id, parseScope(request.nextUrl.searchParams.get("scope")));
    return NextResponse.json({ ok: true, deleted }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
