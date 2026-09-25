import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { createDataBreachSchema } from "@/lib/validations";
import { canReportDataBreach, isDataBreachOverdue, sendUrgentDataBreachAlert } from "@/lib/data-breach";

// The case list — visible to every non-invaller role (same audience as
// who may report one): a datalek is a team-wide accountability matter,
// not something to hide from the people who have to help contain it.
export async function GET() {
  try {
    const session = await requireAuth();
    if (!canReportDataBreach(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }

    const incidents = await db.dataBreachIncident.findMany({
      orderBy: { detectedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      incidents: incidents.map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        detectedAt: i.detectedAt.toISOString(),
        affectedPersonsEstimate: i.affectedPersonsEstimate,
        likelyRisk: i.likelyRisk,
        overdue: isDataBreachOverdue(i),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Reporting is deliberately fast and open to every non-invaller role —
// whoever notices a possible datalek (a lost device, a misdirected
// email, an unlocked screen) should be able to flag it in one step,
// without first tracking down an admin. Triage/assessment/AP-
// notification are separate, narrower steps (see [id]/route.ts's PATCH).
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canReportDataBreach(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }
    const data = createDataBreachSchema.parse(await request.json());

    const detectedAt = new Date(data.detectedAt);
    if (Number.isNaN(detectedAt.getTime())) {
      return NextResponse.json({ error: "Ongeldige ontdekkingsdatum" }, { status: 400 });
    }

    const incident = await db.dataBreachIncident.create({
      data: {
        reportedByUserId: session.sub,
        title: data.title,
        description: data.description,
        affectedData: data.affectedData,
        affectedPersonsEstimate: data.affectedPersonsEstimate,
        severity: data.severity,
        detectedAt,
      },
    });

    await logAudit({
      userId: session.sub,
      action: "data_breach.report",
      targetType: "DataBreachIncident",
      targetId: incident.id,
    });

    await sendUrgentDataBreachAlert({ title: data.title, reportedByName: session.name });

    return NextResponse.json({ ok: true, id: incident.id });
  } catch (error) {
    return handleApiError(error);
  }
}
