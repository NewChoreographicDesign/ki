import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendMonthlyMedicationOverview } from "@/lib/email";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }
  await sendMonthlyMedicationOverview();
  return NextResponse.json({ ok: true });
}
