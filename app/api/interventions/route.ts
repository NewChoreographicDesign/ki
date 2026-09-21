import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createInterventionSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// Creates a new intervention for a client — always starts OPEN. See the
// Intervention model's schema.prisma comment for why there's no DELETE
// route: once created, this is a permanent record.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = createInterventionSchema.parse(await request.json());

    const client = await db.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    }

    const intervention = await db.intervention.create({
      data: {
        clientId: data.clientId,
        description: data.description,
        goal: data.goal,
        stepsTaken: data.stepsTaken,
        followUpNeeded: data.followUpNeeded,
        createdById: session.sub,
      },
    });

    await logAudit({
      userId: session.sub,
      action: "intervention.create",
      targetType: "Intervention",
      targetId: intervention.id,
    });

    return NextResponse.json({ ok: true, intervention });
  } catch (error) {
    return handleApiError(error);
  }
}
