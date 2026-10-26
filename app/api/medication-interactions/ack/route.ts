import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { acknowledgePair, AckError } from "@/lib/interaction-data";

const schema = z.object({
  clientId: z.string().min(1),
  kind: z.enum(["INTERACTION", "DUPLICATE"]),
  medicationA: z.string().min(1),
  medicationB: z.string().min(1),
  reason: z.string().trim().min(3).max(1000),
});

// "Reviewed": who looked at the pair, when, and why — admin-only, same
// as the rest of this app's medication-management routes. It records a
// look, it never changes the medication, and it is valid only until
// either medication changes.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const data = schema.parse(await request.json());
    const client = await db.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    const ack = await acknowledgePair({ userId: session.sub, ...data });
    return NextResponse.json({ ok: true, id: ack.id });
  } catch (error) {
    if (error instanceof AckError) return NextResponse.json({ error: error.message }, { status: error.status });
    return handleApiError(error);
  }
}
