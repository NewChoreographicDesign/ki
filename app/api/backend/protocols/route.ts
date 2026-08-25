import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { protocolSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const body = await request.json();
    const data = protocolSchema.parse(body);

    const protocol = await db.protocol.create({
      data: { title: data.title, content: data.content, clientId: data.clientId || null },
    });

    return NextResponse.json({ ok: true, protocol });
  } catch (error) {
    return handleApiError(error);
  }
}
