import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createDataBreachNoteSchema } from "@/lib/validations";
import { canReportDataBreach } from "@/lib/data-breach";

// Append-only timeline entry, open to the same audience that can
// report/see the case.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!canReportDataBreach(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }
    const { id } = await params;

    const incident = await db.dataBreachIncident.findUnique({ where: { id }, select: { id: true } });
    if (!incident) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    const data = createDataBreachNoteSchema.parse(await request.json());

    const note = await db.dataBreachNote.create({
      data: { incidentId: id, authorId: session.sub, body: data.body },
    });

    return NextResponse.json({
      ok: true,
      note: { id: note.id, authorName: session.name, body: note.body, createdAt: note.createdAt.toISOString() },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
