import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { settingSchema } from "@/lib/validations";

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth([Role.ADMIN, Role.COORDINATOR]);
    const body = await request.json();
    const { key, value } = settingSchema.parse(body);

    const setting = await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json({ ok: true, setting });
  } catch (error) {
    return handleApiError(error);
  }
}
