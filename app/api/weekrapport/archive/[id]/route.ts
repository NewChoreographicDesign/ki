import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, canAccessWeeklyReport } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getWeeklyReportData, parseWeeklyReportSections, WEEKLY_REPORT_SECTION_KEYS } from "@/lib/weekly-report";
import { renderWeeklyReportPdf } from "@/lib/weekly-report-pdf";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!canAccessWeeklyReport(session.role)) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { id } = await params;
    const record = await db.weeklyReportPdf.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Weekrapport niet gevonden" }, { status: 404 });
    }

    const sections = parseWeeklyReportSections(request.nextUrl.searchParams.get("sections"));
    const filename = `weekrapport-week-${record.isoWeek}-${record.isoYear}.pdf`;

    // The stored blob is always the complete week (the permanent archival
    // record — see app/api/cron/weekly-report/route.ts) so it can only be
    // served as-is when every section was asked for. A filtered request
    // regenerates the PDF on demand from the same underlying records this
    // archive was originally built from: Report/MedicationCheck/Todo/
    // Appointment are never purged, and AuditLog (the changelog) is kept for
    // ~2 years — longer than a PDF's own ~1-year retention — so the data
    // for any week that still has an archived PDF is guaranteed to still be
    // there to re-query.
    const isFullDownload = sections.size === WEEKLY_REPORT_SECTION_KEYS.length;
    const pdf = isFullDownload
      ? Buffer.from(record.pdf)
      : await renderWeeklyReportPdf(
          await getWeeklyReportData(record.weekStart, new Date(record.weekStart.getTime() + ONE_WEEK_MS)),
          sections
        );

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
