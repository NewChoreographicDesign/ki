import { db } from "@/lib/db";
import { fullName, startOfToday } from "@/lib/utils";
import { PresenceList, type PresenceClient } from "./presence-list";

export const dynamic = "force-dynamic";

export default async function AanwezigheidPage() {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [clients, presences] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.presence.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
  ]);

  const presenceByClient = new Map(presences.map((p) => [p.clientId, p]));

  const data: PresenceClient[] = clients.map((c) => {
    const p = presenceByClient.get(c.id);
    return {
      id: c.id,
      name: fullName(c),
      present: p ? p.present : null,
      comment: p?.comment ?? "",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Aanwezigheid</h1>
        <p className="mt-1 text-slate-400">Registreer wie er vandaag aanwezig is.</p>
      </div>
      {data.length === 0 ? (
        <p className="text-slate-500">Geen actieve cliënten gevonden.</p>
      ) : (
        <PresenceList clients={data} />
      )}
    </div>
  );
}
