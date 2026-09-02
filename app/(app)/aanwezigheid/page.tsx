import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { PresenceList, type PresenceClient } from "./presence-list";

export const dynamic = "force-dynamic";

export default async function AanwezigheidPage() {
  // Presence is deliberately not scoped to "today": it's a persistent status
  // per client that stays as whoever last set it left it, across shifts and
  // days, until someone changes it again. Each change still writes a new
  // dated row (see app/api/presence/route.ts), so history is kept — this
  // just reads the most recent row per client instead of only today's.
  const [clients, presences] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.presence.findMany({ orderBy: { date: "desc" }, distinct: ["clientId"] }),
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
        <p className="mt-1 text-slate-400">
          Blijvende status per cliënt, gedeeld tussen alle diensten — een wijziging blijft staan
          tot iemand hem weer aanpast.
        </p>
      </div>
      {data.length === 0 ? (
        <p className="text-slate-500">Geen actieve cliënten gevonden.</p>
      ) : (
        <PresenceList clients={data} />
      )}
    </div>
  );
}
