import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { getWeeklyReportData } from "@/lib/weekly-report";
import { renderWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { mostRecentMondayStart, isoWeekOf } from "@/lib/utils";

// Runs every Monday (see vercel.json): archives the week that just ended as
// a permanent PDF (WeeklyReportPdf, see schema.prisma for why it's stored
// in the database rather than external storage) and prunes PDFs older than
// ~1 year, giving a rolling one-year archive instead of unbounded growth.
// This is what "resets" medicatie's live weekly view (app/(app)/medicatie/
// [clientId]/page.tsx already filters to the current week) — the checks
// themselves are never deleted from the database, only archived into the
// PDF and dropped from that live view once the week rolls over.
const RETENTION_MS = 366 * 24 * 60 * 60 * 1000; // ~1 year, with a day of slack for DST

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const now = new Date();
  const currentWeekStart = mostRecentMondayStart(now);
  const weekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekEnd = currentWeekStart;
  const { isoYear, isoWeek } = isoWeekOf(weekStart);

  const existing = await db.weeklyReportPdf.findUnique({
    where: { isoYear_isoWeek: { isoYear, isoWeek } },
  });
  if (!existing) {
    const data = await getWeeklyReportData(weekStart, weekEnd);
    const pdf = await renderWeeklyReportPdf(data);
    await db.weeklyReportPdf.create({
      data: { isoYear, isoWeek, weekStart, pdf: new Uint8Array(pdf) },
    });
  }

  const cutoff = new Date(now.getTime() - RETENTION_MS);
  const { count: pruned } = await db.weeklyReportPdf.deleteMany({
    where: { weekStart: { lt: cutoff } },
  });

  return NextResponse.json({
    ok: true,
    isoYear,
    isoWeek,
    generated: !existing,
    pruned,
  });
}
