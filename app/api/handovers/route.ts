import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, determineShiftType, shiftEndForStart } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { handoverSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { content } = handoverSchema.parse(body);

    const now = new Date();
    const shift = determineShiftType(now);
    const shiftEnd = shiftEndForStart(shift, now);
    const expiresAt = new Date(shiftEnd.getTime() + 60 * 60 * 1000);

    const handover = await db.handover.create({
      data: { userId: session.sub, shift, content, expiresAt },
    });

    return NextResponse.json({ ok: true, handover });
  } catch (error) {
    return handleApiError(error);
  }
}
