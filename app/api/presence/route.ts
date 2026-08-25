import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { startOfToday } from "@/lib/utils";

const toggleSchema = z.object({
  clientId: z.string().min(1),
  present: z.boolean(),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { clientId, present, comment } = toggleSchema.parse(body);

    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    }

    const date = startOfToday();

    const presence = await db.presence.upsert({
      where: { clientId_date: { clientId, date } },
      update: { present, comment: comment || null, userId: session.sub },
      create: { clientId, date, present, comment: comment || null, userId: session.sub },
    });

    return NextResponse.json({ ok: true, presence });
  } catch (error) {
    return handleApiError(error);
  }
}
