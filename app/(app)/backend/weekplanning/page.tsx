import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { WeekPlanManager, type WeekPlanRow } from "./weekplan-manager";

export const dynamic = "force-dynamic";

export default async function WeekplanningPage() {
  const [clients, plans] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.weekPlan.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
  ]);

  const plansByClient: Record<string, WeekPlanRow[]> = {};
  for (const p of plans) {
    plansByClient[p.clientId] ??= [];
    plansByClient[p.clientId].push({
      id: p.id,
      dayOfWeek: p.dayOfWeek,
      startTime: p.startTime,
      endTime: p.endTime,
      activity: p.activity,
      notes: p.notes,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Weekplanning</h1>
        <p className="mt-1 text-slate-400">Weekschema per cliënt.</p>
      </div>
      <WeekPlanManager
        clients={clients.map((c) => ({ id: c.id, name: fullName(c) }))}
        plansByClient={plansByClient}
      />
    </div>
  );
}
