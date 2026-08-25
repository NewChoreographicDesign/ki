import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendMonthlyTodosOverview } from "@/lib/email";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }
  await sendMonthlyTodosOverview();
  return NextResponse.json({ ok: true });
}
