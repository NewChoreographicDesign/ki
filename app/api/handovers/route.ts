import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, determineShiftType } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { handoverSchema } from "@/lib/validations";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { content, clientId } = handoverSchema.parse(body);

    const now = new Date();
    const shift = determineShiftType(now);
    const expiresAt = new Date(now.getTime() + EXPIRY_MS);

    const handover = await db.handover.create({
      data: { userId: session.sub, shift, content, expiresAt, clientId: clientId || null },
    });

    return NextResponse.json({ ok: true, handover });
  } catch (error) {
    return handleApiError(error);
  }
}
