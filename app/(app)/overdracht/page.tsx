import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fullName, parseDaysOfWeek } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { OverdrachtManager } from "./overdracht-manager";

export const dynamic = "force-dynamic";

export default async function OverdrachtPage() {
  const [handovers, interventions, clients, session] = await Promise.all([
    db.handover.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true, client: true },
      orderBy: { createdAt: "desc" },
    }),
    db.intervention.findMany({
      include: {
        client: true,
        createdBy: true,
        closedBy: true,
        notes: { include: { author: true }, orderBy: { createdAt: "asc" } },
        plans: {
          include: {
            tasks: { include: { completedBy: true }, orderBy: { createdAt: "asc" } },
            evaluations: { include: { user: true }, orderBy: { date: "asc" } },
            createdBy: true,
            archivedBy: true,
          },
          orderBy: { version: "desc" },
        },
      },
      // Open ones first (so they always surface at the top regardless of
      // age), newest-created within each group.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Overdracht</h1>
        <p className="mt-1 text-slate-400">
          Per kamer gegroepeerd, plus interventies per cliënt. Overdrachtnotities vervallen
          automatisch 7 dagen na aanmaak — interventies blijven staan tot ze worden afgerond.
        </p>
      </div>
      <OverdrachtManager
        handovers={handovers.map((h) => ({
          id: h.id,
          content: h.content,
          shift: h.shift,
          userName: h.user.name,
          createdAt: h.createdAt.toISOString(),
          expiresAt: h.expiresAt.toISOString(),
          clientName: h.client ? fullName(h.client) : null,
          room: h.client ? h.client.room || "Geen kamer" : null,
        }))}
        interventions={interventions.map((i) => ({
          id: i.id,
          clientName: fullName(i.client),
          room: i.client.room,
          description: i.description,
          goal: i.goal,
          stepsTaken: i.stepsTaken,
          followUpNeeded: i.followUpNeeded,
          status: i.status,
          createdByName: i.createdBy.name,
          createdAt: i.createdAt.toISOString(),
          closedByName: i.closedBy?.name ?? null,
          closedAt: i.closedAt ? i.closedAt.toISOString() : null,
          notes: i.notes.map((n) => ({
            id: n.id,
            content: n.content,
            authorName: n.author.name,
            createdAt: n.createdAt.toISOString(),
          })),
          plans: i.plans.map((p) => ({
            id: p.id,
            version: p.version,
            status: p.status,
            goal: p.goal,
            stepsAanwezigheid: p.stepsAanwezigheid,
            stepsVerzet: p.stepsVerzet,
            stepsHerstelRelatie: p.stepsHerstelRelatie,
            stepsSteunSupport: p.stepsSteunSupport,
            stepsDeescalatie: p.stepsDeescalatie,
            startDate: p.startDate.toISOString(),
            evaluationDate: p.evaluationDate.toISOString(),
            createdByName: p.createdBy.name,
            createdAt: p.createdAt.toISOString(),
            archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
            archivedByName: p.archivedBy?.name ?? null,
            tasks: p.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              priority: t.priority,
              time: t.time,
              recurring: t.recurring,
              daysOfWeek: parseDaysOfWeek(t.daysOfWeek),
              intervalDays: t.intervalDays,
              intervalAnchorDate: t.intervalAnchorDate ? t.intervalAnchorDate.toISOString() : null,
              showUntil: t.showUntil ? t.showUntil.toISOString() : null,
              completed: t.completed,
              completedAt: t.completedAt ? t.completedAt.toISOString() : null,
              completedByName: t.completedBy?.name ?? null,
              completionNote: t.completionNote,
              createdAt: t.createdAt.toISOString(),
            })),
            evaluations: p.evaluations.map((e) => ({
              id: e.id,
              date: e.date.toISOString(),
              pillarsThatHelped: e.pillarsThatHelped,
              reflection: e.reflection,
              decision: e.decision,
              userName: e.user.name,
            })),
          })),
        }))}
        clients={clients.map((c) => ({ id: c.id, name: fullName(c), room: c.room }))}
        canDelete={session?.role === Role.ADMIN}
      />
    </div>
  );
}
