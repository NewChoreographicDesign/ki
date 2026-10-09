import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentSchema } from "@/lib/validations";
import { fullName, parseDatetimeLocalAsAmsterdam } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { datePartOfLocal, expandOccurrenceDates, timePartOfLocal, type RepeatRule } from "@/lib/appointment-recurrence";

const DEFAULT_RANGE_DAYS = 42;
const MAX_RANGE_DAYS = 400;

// Calendar feed for the agenda grid: every appointment overlapping
// [from, to). Open to any authenticated staff member, same as the list.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const params = request.nextUrl.searchParams;
    const from = params.get("from") ? new Date(params.get("from")!) : new Date();
    if (Number.isNaN(from.getTime())) return NextResponse.json({ error: "Ongeldige 'from'" }, { status: 400 });
    let to = params.get("to") ? new Date(params.get("to")!) : new Date(from.getTime() + DEFAULT_RANGE_DAYS * 86_400_000);
    if (Number.isNaN(to.getTime())) return NextResponse.json({ error: "Ongeldige 'to'" }, { status: 400 });
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) to = new Date(from.getTime() + MAX_RANGE_DAYS * 86_400_000);

    const rows = await db.appointment.findMany({
      // An afspraak that started before `from` but runs into it still shows.
      where: { startAt: { gte: new Date(from.getTime() - 86_400_000), lt: to } },
      include: { client: { select: { id: true, firstName: true, lastName: true, room: true } } },
      orderBy: { startAt: "asc" },
    });
    const appointments = rows
      .filter((a) => (a.endAt ?? new Date(a.startAt.getTime() + 3_600_000)) > from)
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        clientId: a.clientId,
        clientName: a.client ? fullName(a.client) : null,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt ? a.endAt.toISOString() : null,
        seriesId: a.seriesId,
      }));
    return NextResponse.json({ appointments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = appointmentSchema.parse(await request.json());

    const firstStart = parseDatetimeLocalAsAmsterdam(data.startAt);
    if (!firstStart) {
      return NextResponse.json({ error: "Ongeldige datum/tijd" }, { status: 400 });
    }
    let durationMs: number | null = null;
    if (data.endAt) {
      const end = parseDatetimeLocalAsAmsterdam(data.endAt);
      if (!end) return NextResponse.json({ error: "Ongeldige eindtijd" }, { status: 400 });
      if (end <= firstStart) return NextResponse.json({ error: "De eindtijd moet na de begintijd liggen" }, { status: 400 });
      durationMs = end.getTime() - firstStart.getTime();
    }

    if (data.clientId) {
      const client = await db.client.findUnique({ where: { id: data.clientId } });
      if (!client) {
        return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
      }
    }

    let dates: string[];
    try {
      dates = expandOccurrenceDates(datePartOfLocal(data.startAt), (data.repeat ?? { mode: "none" }) as RepeatRule);
    } catch (error) {
      return NextResponse.json({ error: error instanceof RangeError ? error.message : "Ongeldige herhaling" }, { status: 400 });
    }

    const time = timePartOfLocal(data.startAt);
    const seriesId = dates.length > 1 ? randomUUID() : null;
    const rows = dates.map((date) => {
      const startAt = parseDatetimeLocalAsAmsterdam(`${date}T${time}`)!;
      return {
        title: data.title,
        description: data.description || null,
        clientId: data.clientId || null,
        startAt,
        endAt: durationMs ? new Date(startAt.getTime() + durationMs) : null,
        seriesId,
        createdById: session.sub,
      };
    });
    await db.appointment.createMany({ data: rows });

    await logAudit({
      userId: session.sub,
      action: seriesId ? `appointment.create_series:${rows.length}` : "appointment.create",
      targetType: "Appointment",
      targetId: seriesId ?? undefined,
    });

    return NextResponse.json({ ok: true, count: rows.length, seriesId });
  } catch (error) {
    return handleApiError(error);
  }
}
