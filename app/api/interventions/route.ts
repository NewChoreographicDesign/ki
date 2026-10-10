import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createInterventionSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// Creates a new intervention for one or more clients — always starts OPEN.
// See the Intervention model's schema.prisma comment for why there's no
// DELETE route: once created, this is a permanent record.
//
// More than one clientId (several residents picked, or "hele groep") makes
// one Intervention row per client, sharing a groupInterventionId so the UI
// can show them as one action — each row still has its own status/notes/
// close, since different clients rarely resolve on the same timeline.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = createInterventionSchema.parse(await request.json());
    const clientIds = [...new Set(data.clientIds)];

    const clients = await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true } });
    if (clients.length !== clientIds.length) {
      return NextResponse.json({ error: "Een of meer cliënten zijn niet gevonden" }, { status: 404 });
    }

    const groupInterventionId = clientIds.length > 1 ? randomUUID() : null;
    await db.intervention.createMany({
      data: clientIds.map((clientId) => ({
        clientId,
        groupInterventionId,
        description: data.description,
        goal: data.goal,
        stepsTaken: data.stepsTaken,
        followUpNeeded: data.followUpNeeded,
        createdById: session.sub,
      })),
    });

    await logAudit({
      userId: session.sub,
      action: groupInterventionId ? `intervention.create_group:${clientIds.length}` : "intervention.create",
      targetType: "Intervention",
      targetId: groupInterventionId ?? undefined,
    });

    return NextResponse.json({ ok: true, count: clientIds.length, groupInterventionId });
  } catch (error) {
    return handleApiError(error);
  }
}
