import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { updateDataBreachSchema } from "@/lib/validations";
import { canReportDataBreach, canManageDataBreach, isDataBreachOverdue, dataBreachDeadline } from "@/lib/data-breach";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!canReportDataBreach(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }
    const { id } = await params;

    const incident = await db.dataBreachIncident.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: "asc" } } },
    });
    if (!incident) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    const userIds = Array.from(new Set([incident.reportedByUserId, ...incident.notes.map((n) => n.authorId)]));
    const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const userName = new Map(users.map((u) => [u.id, u.name]));

    return NextResponse.json({
      incident: {
        id: incident.id,
        title: incident.title,
        description: incident.description,
        affectedData: incident.affectedData,
        affectedPersonsEstimate: incident.affectedPersonsEstimate,
        severity: incident.severity,
        status: incident.status,
        detectedAt: incident.detectedAt.toISOString(),
        likelyRisk: incident.likelyRisk,
        apNotifiedAt: incident.apNotifiedAt?.toISOString() ?? null,
        apReference: incident.apReference,
        dataSubjectsNotifiedAt: incident.dataSubjectsNotifiedAt?.toISOString() ?? null,
        closedAt: incident.closedAt?.toISOString() ?? null,
        closedSummary: incident.closedSummary,
        reportedByName: userName.get(incident.reportedByUserId) ?? "Onbekend",
        deadline: dataBreachDeadline(incident)?.toISOString() ?? null,
        overdue: isDataBreachOverdue(incident),
        canManage: canManageDataBreach(session.role),
        notes: incident.notes.map((n) => ({
          id: n.id,
          authorName: userName.get(n.authorId) ?? "Onbekend",
          body: n.body,
          createdAt: n.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// The AVG-workflow transitions — admin only. Deliberately no
// "un-notify": once apNotifiedAt/dataSubjectsNotifiedAt are set, they
// stay set.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!canManageDataBreach(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }
    const { id } = await params;
    const data = updateDataBreachSchema.parse(await request.json());

    const existing = await db.dataBreachIncident.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    const apNotifiedAt = data.apNotifiedAt ? new Date(data.apNotifiedAt) : undefined;
    const dataSubjectsNotifiedAt = data.dataSubjectsNotifiedAt ? new Date(data.dataSubjectsNotifiedAt) : undefined;
    if (apNotifiedAt && Number.isNaN(apNotifiedAt.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
    }
    if (dataSubjectsNotifiedAt && Number.isNaN(dataSubjectsNotifiedAt.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
    }

    const incident = await db.dataBreachIncident.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.likelyRisk !== undefined ? { likelyRisk: data.likelyRisk } : {}),
        ...(apNotifiedAt ? { apNotifiedAt } : {}),
        ...(data.apReference !== undefined ? { apReference: data.apReference || null } : {}),
        ...(dataSubjectsNotifiedAt ? { dataSubjectsNotifiedAt } : {}),
        ...(data.status === "CLOSED" ? { closedAt: new Date() } : {}),
        ...(data.closedSummary !== undefined ? { closedSummary: data.closedSummary || null } : {}),
      },
    });

    await logAudit({ userId: session.sub, action: "data_breach.update", targetType: "DataBreachIncident", targetId: id });

    return NextResponse.json({ ok: true, incident });
  } catch (error) {
    return handleApiError(error);
  }
}
