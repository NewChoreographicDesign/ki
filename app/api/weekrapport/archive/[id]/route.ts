import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, canAccessWeeklyReport } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const filename = `weekrapport-week-${record.isoWeek}-${record.isoYear}.pdf`;
    return new NextResponse(new Uint8Array(record.pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
