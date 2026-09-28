import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, canAccessWeeklyReport } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getWeeklyReportData, parseWeeklyReportSections } from "@/lib/weekly-report";
import { renderWeeklyReportPdf } from "@/lib/weekly-report-pdf";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!canAccessWeeklyReport(session.role)) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { id } = await params;
    const record = await db.weeklyReportPdf.findUnique({
      where: { id },
      select: { isoYear: true, isoWeek: true, weekStart: true },
    });
    if (!record) {
      return NextResponse.json({ error: "Weekrapport niet gevonden" }, { status: 404 });
    }

    const sections = parseWeeklyReportSections(request.nextUrl.searchParams.get("sections"));
    const filename = `weekrapport-week-${record.isoWeek}-${record.isoYear}.pdf`;

    // Always regenerate from source data rather than serving the stored
    // WeeklyReportPdf.pdf blob — that column is a snapshot frozen at archive
    // time, so once the PDF's own layout/styling changes (see
    // lib/weekly-report-pdf.ts), serving it as-is would keep handing out a
    // stale-looking document for every already-archived week until it ages
    // out a year later, even though the report's actual DATA never changed.
    // Report/MedicationCheck/Todo/Appointment are never purged, and AuditLog
    // (the changelog) is kept for ~2 years — longer than a PDF's own ~1-year
    // retention — so the underlying records for any week that still has an
    // archived row are guaranteed to still be there to re-render from.
    const pdf = await renderWeeklyReportPdf(
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
