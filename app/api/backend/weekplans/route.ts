import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { weekPlanSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    await requireAuth([Role.ADMIN]);
    const body = await request.json();
    const data = weekPlanSchema.parse(body);

    const weekPlan = await db.weekPlan.create({
      data: {
        clientId: data.clientId,
        userId: data.userId || null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        activity: data.activity,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ ok: true, weekPlan });
  } catch (error) {
    return handleApiError(error);
  }
}
