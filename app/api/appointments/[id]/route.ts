import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentSchema } from "@/lib/validations";
import { formatDateTime, fullName } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = appointmentSchema.parse(body);

    const startAt = new Date(data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum/tijd" }, { status: 400 });
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

    const changes = describeChanges(
      existing,
      { title: data.title, description: data.description || null, clientId: newClientId, startAt },
      beforeClient ? fullName(beforeClient) : null,
      afterClient ? fullName(afterClient) : null
    );

    const appointment = await db.appointment.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description || null,
        clientId: newClientId,
        startAt,
      },
    });

    if (changes) {
      await logAudit({
        userId: session.sub,
        action: `appointment.edited:${changes}`,
        targetType: "Appointment",
        targetId: id,
      });
    }

    return NextResponse.json({ ok: true, appointment });
  } catch (error) {
    return handleApiError(error);
  }
}
