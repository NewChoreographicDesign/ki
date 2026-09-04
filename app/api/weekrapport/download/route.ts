import { NextResponse } from "next/server";
import { requireAuth, canAccessWeeklyReport } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getWeeklyReportData, renderWeeklyReportText } from "@/lib/weekly-report";
import { formatDDMMYYYY, mostRecentMondayStart } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!canAccessWeeklyReport(session.role)) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const data = await getWeeklyReportData(mostRecentMondayStart());
    const text = renderWeeklyReportText(data);
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
