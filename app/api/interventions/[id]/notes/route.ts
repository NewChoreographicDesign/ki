import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createInterventionNoteSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// Adds one follow-up entry to an intervention's timeline — refused once
// the intervention is closed (AFGEROND), same as re-opening one isn't
// possible: closing is meant to be the final word, not a toggle.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { content } = createInterventionNoteSchema.parse(await request.json());

    const intervention = await db.intervention.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!intervention) {
      return NextResponse.json({ error: "Interventie niet gevonden" }, { status: 404 });
    }
    if (intervention.status === "AFGEROND") {
      return NextResponse.json({ error: "Deze interventie is al afgerond" }, { status: 400 });
    }

    const note = await db.interventionNote.create({
      data: { interventionId: id, authorId: session.sub, content },
    });

    await logAudit({
      userId: session.sub,
      action: "intervention.note",
      targetType: "Intervention",
      targetId: id,
    });

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    return handleApiError(error);
  }
}
