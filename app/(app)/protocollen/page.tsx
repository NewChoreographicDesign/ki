import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { ProtocolManager } from "./protocol-manager";

export const dynamic = "force-dynamic";

export default async function ProtocollenPage() {
  const [protocols, clients, session] = await Promise.all([
    db.protocol.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Protocollen</h1>
        <p className="mt-1 text-slate-400">Algemene en cliëntspecifieke protocollen.</p>
      </div>
      <ProtocolManager
        protocols={protocols.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          clientName: p.client ? fullName(p.client) : null,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: fullName(c) }))}
        canDelete={session?.role === Role.ADMIN || session?.role === Role.COORDINATOR}
      />
    </div>
  );
}
