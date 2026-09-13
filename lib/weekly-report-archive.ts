import "server-only";
import { db } from "@/lib/db";
import { getWeeklyReportData } from "@/lib/weekly-report";
import { renderWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { mostRecentMondayStart, isoWeekOf } from "@/lib/utils";

const RETENTION_MS = 366 * 24 * 60 * 60 * 1000; // ~1 year, with a day of slack for DST

// A once-a-week cron (app/api/cron/weekly-report/route.ts) has no retry: if
// it doesn't fire (missing/misconfigured CRON_SECRET, a cold-start timeout,
// Vercel cron simply not triggering that day), the week it would have
// archived is gone for good once the cutoff below passes it by — nothing
// else in the app protects that PDF from just never having existed. Report,
// MedicationCheck, Todo, and AuditLog rows are never purged on their own
// (see prisma/schema.prisma retention notes), so the raw data for any
// already-completed week within the retention window is always still there
// to regenerate from — this walks backwards from the most recently
// completed week and fills in any gap it finds, the same self-healing
// pattern as regenerateRecurringTodos() (lib/recurring-todos.ts) uses for
// to-dos that a once-a-day/week cron alone can't be trusted to keep in sync.
const MAX_BACKFILL_WEEKS = 8;

/**
 * Creates any missing WeeklyReportPdf between the most recently completed
 * week and the retention cutoff. `existingWeeks` should be the isoYear/
 * isoWeek pairs already known to exist (from a findMany the caller already
 * did) so this never re-queries what it doesn't have to. Returns the number
 * of weeks actually created — callers that render the archive list should
 * re-fetch it when this is non-zero.
 */
export async function backfillMissingWeeklyReports(
  existingWeeks: { isoYear: number; isoWeek: number }[],
  now: Date = new Date()
): Promise<number> {
  const existing = new Set(existingWeeks.map((w) => `${w.isoYear}-${w.isoWeek}`));
  const cutoff = new Date(now.getTime() - RETENTION_MS);

  let weekEnd = mostRecentMondayStart(now);
  let created = 0;

  for (let i = 0; i < MAX_BACKFILL_WEEKS; i++) {
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (weekStart < cutoff) break;

    const { isoYear, isoWeek } = isoWeekOf(weekStart);
    const key = `${isoYear}-${isoWeek}`;
    if (!existing.has(key)) {
      const data = await getWeeklyReportData(weekStart, weekEnd);
      const pdf = await renderWeeklyReportPdf(data);
      // Another concurrent request (or the cron, running at the same time)
      // may have created this exact week in between our findMany and here —
      // isoYear_isoWeek is unique, so let that race lose gracefully instead
      // of crashing the page load.
      await db.weeklyReportPdf.upsert({
        where: { isoYear_isoWeek: { isoYear, isoWeek } },
        create: { isoYear, isoWeek, weekStart, pdf: new Uint8Array(pdf) },
        update: {},
      });
      existing.add(key);
      created++;
    }

    weekEnd = weekStart;
  }

  return created;
}
