import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { reportSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { isWithinReportAuthorWindow } from "@/lib/report-window";

// Adjusting a rapportage is the author's own privilege, and only within the
// same window that makes it visible to them at all (see
// lib/report-window.ts) — not even ADMIN can edit someone else's, matching
// "only the person who made it can see it and adjust it".
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await db.report.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rapportage niet gevonden" }, { status: 404 });
    }
    if (existing.userId !== session.sub) {
      throw new AuthError("Geen toegang", 403);
    }
    if (!isWithinReportAuthorWindow(existing.createdAt)) {
      return NextResponse.json({ error: "Deze rapportage kan niet meer aangepast worden" }, { status: 403 });
    }

    const body = await request.json();
    const data = reportSchema.parse(body);

    const date = parseDDMMYYYY(data.date);
    if (!date) {
      return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    }

    const report = await db.report.update({
      where: { id },
      data: { clientId: data.clientId, shift: data.shift, date, content: data.content },
    });

    await logAudit({
      userId: session.sub,
      action: "report.update",
      targetType: "Client",
      targetId: client.id,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return handleApiError(error);
  }
}
