import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentSchema } from "@/lib/validations";
import { formatDateTime, fullName, parseDatetimeLocalAsAmsterdam, toDatetimeLocalValue } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { datePartOfLocal, formatYmd, parseYmd, timePartOfLocal } from "@/lib/appointment-recurrence";

type Scope = "this" | "following" | "all";

// Any authenticated staff member can correct a planned appointment (wrong
// time, wrong client, a typo) - there's no admin gate here on purpose, since
// mistakes need to be fixable quickly by whoever spots them. What keeps this
// safe is accountability, not restriction: every edit is written to the
// audit trail with who made it and exactly what changed, and the same diff
// surfaces in the weekrapport changelog so it's never a silent rewrite.
function describeChanges(
  before: { title: string; description: string | null; clientId: string | null; startAt: Date },
  after: { title: string; description: string | null; clientId: string | null; startAt: Date },
  beforeClientName: string | null,
  afterClientName: string | null
): string | null {
  const parts: string[] = [];
  if (before.title !== after.title) {
    parts.push(`titel "${before.title}" -> "${after.title}"`);
  }
  if (before.startAt.getTime() !== after.startAt.getTime()) {
    parts.push(`tijd ${formatDateTime(before.startAt)} -> ${formatDateTime(after.startAt)}`);
  }
  if (before.clientId !== after.clientId) {
    parts.push(`cliënt ${beforeClientName ?? "geen"} -> ${afterClientName ?? "geen"}`);
  }
  if ((before.description || "") !== (after.description || "")) {
    parts.push("omschrijving aangepast");
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

// The rows a series-wide action applies to. A standalone afspraak (no
// seriesId) is always just itself, whatever scope was asked for.
async function targetRows(existing: { id: string; seriesId: string | null; startAt: Date }, scope: Scope) {
  if (scope === "this" || !existing.seriesId) return [await db.appointment.findUniqueOrThrow({ where: { id: existing.id } })];
  return db.appointment.findMany({
    where: { seriesId: existing.seriesId, ...(scope === "following" ? { startAt: { gte: existing.startAt } } : {}) },
    orderBy: { startAt: "asc" },
  });
}

function parseScope(value: string | null | undefined): Scope {
  return value === "following" || value === "all" ? value : "this";
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = appointmentSchema.parse(await request.json());
    const scope = parseScope(data.scope);

    const startAt = parseDatetimeLocalAsAmsterdam(data.startAt);
    if (!startAt) {
      return NextResponse.json({ error: "Ongeldige datum/tijd" }, { status: 400 });
    }
    let durationMs: number | null = null;
    if (data.endAt) {
      const end = parseDatetimeLocalAsAmsterdam(data.endAt);
      if (!end) return NextResponse.json({ error: "Ongeldige eindtijd" }, { status: 400 });
      if (end <= startAt) return NextResponse.json({ error: "De eindtijd moet na de begintijd liggen" }, { status: 400 });
      durationMs = end.getTime() - startAt.getTime();
    }

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Afspraak niet gevonden" }, { status: 404 });
    }

    const newClientId = data.clientId || null;
    const clientChanged = newClientId !== existing.clientId;
    const [beforeClient, afterClient] = await Promise.all([
      clientChanged && existing.clientId ? db.client.findUnique({ where: { id: existing.clientId } }) : null,
      clientChanged && newClientId ? db.client.findUnique({ where: { id: newClientId } }) : null,
    ]);
    if (clientChanged && newClientId && !afterClient) {
      return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    }

    const changes = describeChanges(
      existing,
      { title: data.title, description: data.description || null, clientId: newClientId, startAt },
      beforeClient ? fullName(beforeClient) : null,
      afterClient ? fullName(afterClient) : null
    );

    const rows = await targetRows(existing, scope);
    const oldDate = parseYmd(datePartOfLocal(toDatetimeLocalValue(existing.startAt)))!;
    const dayDelta = Math.round((parseYmd(datePartOfLocal(data.startAt))! - oldDate) / 86_400_000);
    const newTime = timePartOfLocal(data.startAt);

    for (const row of rows) {
      let rowStart = startAt;
      if (row.id !== existing.id) {
        // Series-wide edit: each other occurrence keeps its own date
        // (shifted by the same number of days the edited one moved), takes
        // the new time-of-day — DST-correct via the Amsterdam parse.
        const rowDate = parseYmd(datePartOfLocal(toDatetimeLocalValue(row.startAt)))! + dayDelta * 86_400_000;
        rowStart = parseDatetimeLocalAsAmsterdam(`${formatYmd(rowDate)}T${newTime}`)!;
      }
      await db.appointment.update({
        where: { id: row.id },
        data: {
          title: data.title,
          description: data.description || null,
          clientId: newClientId,
          startAt: rowStart,
          endAt: durationMs ? new Date(rowStart.getTime() + durationMs) : null,
          // Moving the time of an already-reminded afspraak must re-arm its reminder.
          ...(rowStart.getTime() !== row.startAt.getTime() ? { reminderSent: false } : {}),
        },
      });
    }

    if (changes || rows.length > 1) {
      await logAudit({
        userId: session.sub,
        action: `appointment.edited:${changes ?? "series"}${rows.length > 1 ? ` (${scope}, ${rows.length}x)` : ""}`,
        targetType: "Appointment",
        targetId: id,
      });
    }

    return NextResponse.json({ ok: true, updated: rows.length });
  } catch (error) {
    return handleApiError(error);
  }
}

// Same permissive-but-audited model as PATCH above: no role gate, any
// staff member can remove an appointment they realize is wrong (duplicate,
// cancelled, created for the wrong day) — the audit trail is what keeps
// this accountable rather than a confirmation dialog. For a repeated
// afspraak `?scope=this|following|all` picks how much of the series goes.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const scope = parseScope(request.nextUrl.searchParams.get("scope"));

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Afspraak niet gevonden" }, { status: 404 });
    }

    const rows = await targetRows(existing, scope);
    await db.appointment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });

    await logAudit({
      userId: session.sub,
      action: `appointment.deleted:"${existing.title}"${rows.length > 1 ? ` (${scope}, ${rows.length}x)` : ""}`,
      targetType: "Appointment",
      targetId: id,
    });

    return NextResponse.json({ ok: true, deleted: rows.length });
  } catch (error) {
    return handleApiError(error);
  }
}
