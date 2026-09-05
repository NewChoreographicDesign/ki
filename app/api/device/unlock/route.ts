import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signDeviceToken, isDeviceRestrictionEnabled, DEVICE_TOKEN_COOKIE } from "@/lib/device-auth";
import { secureCompare } from "@/lib/secure-compare";
import {
  isDeviceUnlockLocked,
  recordDeviceUnlockFailure,
  resetDeviceUnlockFailures,
} from "@/lib/device-lockout";

const schema = z.object({ passcode: z.string().min(1) });

export async function POST(request: NextRequest) {
  if (!isDeviceRestrictionEnabled()) {
    return NextResponse.json({ error: "Apparaatbeveiliging staat niet aan" }, { status: 400 });
  }

  if (await isDeviceUnlockLocked()) {
    return NextResponse.json(
      { error: "Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Voer een wachtwoord in" }, { status: 400 });
  }

  const expected = (process.env.DEVICE_PASSCODE ?? "").trim();
  if (!expected || !secureCompare(parsed.data.passcode.trim(), expected)) {
    await recordDeviceUnlockFailure();
    return NextResponse.json({ error: "Onjuist apparaat-wachtwoord" }, { status: 401 });
  }

  await resetDeviceUnlockFailures();
  const token = await signDeviceToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEVICE_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 365 * 24 * 60 * 60, // 10 years, matches the token's own expiry
  });
  return response;
}
