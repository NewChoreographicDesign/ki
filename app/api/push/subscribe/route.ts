import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { pushSubscribeSchema } from "@/lib/validations";
import { db } from "@/lib/db";

// Registers this browser/device for Web Push, tied to the current user.
// Upserted on endpoint: re-subscribing (e.g. after the browser rotates the
// endpoint, or the same device subscribing again) just refreshes the keys
// rather than erroring on a duplicate.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = pushSubscribeSchema.parse(await request.json());

    await db.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: { userId: session.sub, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth },
      update: { userId: session.sub, p256dh: data.keys.p256dh, auth: data.keys.auth },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
