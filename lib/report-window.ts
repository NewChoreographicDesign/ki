// A rapportage is only ever shown to its own author — and only editable by
// them — for this long after creation (see Report.adminOnly's schema.prisma
// comment: every report is admin-only by default; this is the one, time-
// boxed exception). Past this window it simply drops out of the author's
// own /rapportage list too, same as it already never showed to anyone else.
// Shared by the list query (app/(app)/rapportage/page.tsx) and the edit
// route (app/api/reports/[id]/route.ts) so both enforce the same cutoff.
export const REPORT_AUTHOR_WINDOW_MS = 25 * 60 * 60 * 1000;

export function isWithinReportAuthorWindow(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= REPORT_AUTHOR_WINDOW_MS;
}
