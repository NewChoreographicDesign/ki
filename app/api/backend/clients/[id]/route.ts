import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

const patchSchema = z.object({
  active: z.boolean().optional(),
  room: z.string().trim().max(100).optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth([Role.ADMIN]);
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    const client = await db.client.update({
      where: { id },
      data: {
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.room !== undefined ? { room: data.room || null } : {}),
      },
    });
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    return handleApiError(error);
  }
}
