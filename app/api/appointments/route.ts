import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentSchema } from "@/lib/validations";
import { createAppointments, listAgenda, loadAppointment, toAgendaItem } from "@/lib/agenda";
import { type RepeatRule } from "@/lib/appointment-recurrence";

const DEFAULT_RANGE_DAYS = 42;
const NO_STORE = { "Cache-Control": "no-store" };

// Agenda feed: every afspraak overlapping [from, to).
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const params = request.nextUrl.searchParams;
    const from = params.get("from") ? new Date(params.get("from")!) : new Date();
    if (Number.isNaN(from.getTime())) return NextResponse.json({ error: "Ongeldige 'from'" }, { status: 400 });
    const to = params.get("to") ? new Date(params.get("to")!) : new Date(from.getTime() + DEFAULT_RANGE_DAYS * 86_400_000);
    if (Number.isNaN(to.getTime())) return NextResponse.json({ error: "Ongeldige 'to'" }, { status: 400 });
    const appointments = await listAgenda(from, to);
    return NextResponse.json({ appointments, serverTime: new Date().toISOString() }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = appointmentSchema.parse(await request.json());
    const { ids, seriesId } = await createAppointments(session, data, (data.repeat ?? { mode: "none" }) as RepeatRule);
    const first = toAgendaItem(await loadAppointment(ids[0]));
    return NextResponse.json({ ok: true, count: ids.length, seriesId, appointment: first }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
