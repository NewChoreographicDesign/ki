import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { backfillMissingWeeklyReports } from "@/lib/weekly-report-archive";

// Runs every Monday (see vercel.json): archives the week that just ended as
// a permanent PDF (WeeklyReportPdf, see schema.prisma for why it's stored
// in the database rather than external storage) and prunes PDFs older than
// ~1 year, giving a rolling one-year archive instead of unbounded growth.
// This is what "resets" medicatie's live weekly view (app/(app)/medicatie/
// [clientId]/page.tsx already filters to the current week) — the checks
// themselves are never deleted from the database, only archived into the
// PDF and dropped from that live view once the week rolls over.
//
// Uses the same backfillMissingWeeklyReports() as the /weekrapport page
// itself (lib/weekly-report-archive.ts), not just a single-week check —
// a cron run that got skipped (misconfigured secret, a missed trigger)
// used to mean that week's archive was gone for good; now the next run
// (or the next time anyone opens /weekrapport) fills the gap in.
//
// Recurring to-do regeneration used to be bundled in here too, but a task
// can now recur on any subset of days (not just "weekly"), which a
// once-a-week cron can't time correctly — it's handled on every Todos page
// load instead (regenerateRecurringTodos(), lib/recurring-todos.ts).
const RETENTION_MS = 366 * 24 * 60 * 60 * 1000; // ~1 year, with a day of slack for DST

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const now = new Date();
  const existingWeeks = await db.weeklyReportPdf.findMany({
    select: { isoYear: true, isoWeek: true },
  });
  const created = await backfillMissingWeeklyReports(existingWeeks, now);

  const cutoff = new Date(now.getTime() - RETENTION_MS);
  const { count: pruned } = await db.weeklyReportPdf.deleteMany({
    where: { weekStart: { lt: cutoff } },
  });

  return NextResponse.json({ ok: true, created, pruned });
}
