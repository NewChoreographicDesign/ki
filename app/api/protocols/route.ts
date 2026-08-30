import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { protocolSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    // Protocols live in the main menu now, open to every logged-in role —
    // only deleting (see [id]/route.ts) stays restricted.
    await requireAuth();
    const body = await request.json();
    const data = protocolSchema.parse(body);

    const protocol = await db.protocol.create({
      data: {
        title: data.title,
        content: data.content || null,
        url: data.url || null,
        clientId: data.clientId || null,
      },
    });

    return NextResponse.json({ ok: true, protocol });
  } catch (error) {
    return handleApiError(error);
  }
}
