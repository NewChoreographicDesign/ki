import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createInterventionSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

// Creates a new intervention for one or more clients, or the whole group —
// always starts OPEN. See the Intervention model's schema.prisma comment
// for why there's no DELETE route: once created, this is a permanent record.
//
// Always exactly one Intervention row, whatever its scope — see
// Intervention.clients/wholeGroup in schema.prisma for why several
// clients (or "hele groep") don't fan out into several rows.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = createInterventionSchema.parse(await request.json());
    const clientIds = data.wholeGroup ? [] : [...new Set(data.clientIds)];

    if (clientIds.length > 0) {
      const clients = await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true } });
      if (clients.length !== clientIds.length) {
        return NextResponse.json({ error: "Een of meer cliënten zijn niet gevonden" }, { status: 404 });
      }
    }

    const intervention = await db.intervention.create({
      data: {
        wholeGroup: data.wholeGroup,
        description: data.description,
        goal: data.goal,
        stepsTaken: data.stepsTaken,
        followUpNeeded: data.followUpNeeded,
        createdById: session.sub,
        clients: { createMany: { data: clientIds.map((clientId) => ({ clientId })) } },
      },
    });

    await logAudit({
      userId: session.sub,
      action: data.wholeGroup ? "intervention.create_whole_group" : clientIds.length > 1 ? `intervention.create_group:${clientIds.length}` : "intervention.create",
      targetType: "Intervention",
      targetId: intervention.id,
    });

    return NextResponse.json({ ok: true, intervention });
  } catch (error) {
    return handleApiError(error);
  }
}
