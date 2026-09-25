import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { runAuditReview } from "@/lib/audit-review";

// Runs daily (see vercel.json) — the demonstrable, regular half of "log
// review": see lib/audit-review.ts for what it actually checks. Always
// writes an AuditReviewRun row, even when nothing is found, so the
// review history itself is the proof this runs on a schedule rather than
// only when someone remembers to look.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const result = await runAuditReview();
  return NextResponse.json({ ok: true, ...result });
}
