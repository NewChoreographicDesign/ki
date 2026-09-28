import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth, canAccessWeeklyReport } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getWeeklyReportData, renderWeeklyReportText, parseWeeklyReportSections } from "@/lib/weekly-report";
import { renderWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { formatDDMMYYYY, mostRecentMondayStart } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canAccessWeeklyReport(session.role)) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const sections = parseWeeklyReportSections(request.nextUrl.searchParams.get("sections"));
    // See the same COORDINATOR-vs-ADMIN note in app/(app)/weekrapport/page.tsx.
    const data = await getWeeklyReportData(mostRecentMondayStart(), new Date(), session.role === Role.ADMIN);

    // The live, still-in-progress week previously only downloaded as plain
    // .txt (the archived past weeks already got the styled PDF) — ?format=pdf
    // renders that exact same layout on demand instead, so "Voortgang" gets
    // the same visual upgrade as the archive. .txt is kept as the default:
    // it's still the faster, script/copy-paste-friendly option.
    const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "txt";

    if (format === "pdf") {
      const pdf = await renderWeeklyReportPdf(data, sections);
      const filename = `weekrapport-voortgang-${formatDDMMYYYY(data.weekStart)}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const text = renderWeeklyReportText(data, sections);
    const filename = `weekrapport-${formatDDMMYYYY(data.weekStart)}.txt`;

    return new NextResponse(text, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
