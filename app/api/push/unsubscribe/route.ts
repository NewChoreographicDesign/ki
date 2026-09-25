import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { pushUnsubscribeSchema } from "@/lib/validations";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = pushUnsubscribeSchema.parse(await request.json());

    // deleteMany, not delete: scoped to this user's own endpoint so one
    // user can never remove another's registration by guessing/replaying
    // an endpoint URL, and it's a no-op (not a 404) if it's already gone.
    await db.pushSubscription.deleteMany({ where: { endpoint: data.endpoint, userId: session.sub } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
