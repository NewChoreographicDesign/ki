import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["ADMIN", "COORDINATOR", "EMPLOYEE"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth([Role.ADMIN]);
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    const user = await db.user.update({ where: { id }, data });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
