import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { settingSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const body = await request.json();
    const { key, value } = settingSchema.parse(body);

    const setting = await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    await logAudit({ userId: session.sub, action: "setting.update", targetType: "Setting", targetId: key });

    return NextResponse.json({ ok: true, setting });
  } catch (error) {
    return handleApiError(error);
  }
}
