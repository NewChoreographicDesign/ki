import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const { id } = await params;
    const { active } = patchSchema.parse(await request.json());

    const client = await db.client.update({ where: { id }, data: { active } });
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    return handleApiError(error);
  }
}
