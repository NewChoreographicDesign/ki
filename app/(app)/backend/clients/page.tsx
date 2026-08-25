import { db } from "@/lib/db";
import { ClientManager } from "./client-manager";

export const dynamic = "force-dynamic";

export default async function BackendClientsPage() {
  const clients = await db.client.findMany({ orderBy: { firstName: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Cliënten</h1>
        <p className="mt-1 text-slate-400">Beheer cliëntgegevens. Wijzigingen werken overal door.</p>
      </div>
      <ClientManager clients={clients} />
    </div>
  );
}
