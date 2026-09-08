import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { OverdrachtManager } from "./overdracht-manager";

export const dynamic = "force-dynamic";

export default async function OverdrachtPage() {
  const [handovers, clients, session] = await Promise.all([
    db.handover.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true, client: true },
      orderBy: { createdAt: "desc" },
    }),
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Overdracht</h1>
        <p className="mt-1 text-slate-400">
          Per kamer gegroepeerd, plus een apart overzicht voor algemene overdrachten. Notities
          vervallen automatisch 7 dagen na aanmaak.
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
        clients={clients.map((c) => ({ id: c.id, name: fullName(c), room: c.room }))}
        canDelete={session?.role === Role.ADMIN}
      />
    </div>
  );
}
