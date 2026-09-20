import Link from "next/link";
import { DoorOpen, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { startOfToday, cn, fullName } from "@/lib/utils";
import {
  buildMedicationOverviewRow,
  groupMedicationOverviewByRoom,
  type MedicationOverviewRow,
} from "@/lib/medication-schedule";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MedicatiePage() {
  const todayStart = startOfToday();
  const clients = await db.client.findMany({
    where: { active: true },
    orderBy: { firstName: "asc" },
    include: {
      medications: {
        where: { active: true },
        include: {
          checks: {
            where: { checkedAt: { gte: todayStart } },
            include: { user: true },
            orderBy: { checkedAt: "asc" },
          },
        },
      },
    },
  });

  const rows = clients.flatMap((client) =>
    client.medications.map((med) => ({
      ...buildMedicationOverviewRow(
        client,
        med,
        med.checks.map((c) => ({ id: c.id, checkedAt: c.checkedAt, status: c.status, userName: c.user.name }))
      ),
      room: client.room,
    }))
  );

  const grouped = groupMedicationOverviewByRoom(rows);
  // Clients with no active medication have nothing to sort into the
  // time-ordered view above, but their (empty) medicatie page should stay
  // reachable — e.g. right after a med was deactivated, or before one's
  // been added yet.
  const clientsWithoutMeds = clients.filter((c) => c.medications.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Medicatie</h1>
        <p className="mt-1 text-slate-400">
          Per kamer, gesorteerd op tijd — de eerstvolgende inname staat bovenaan. Eenmaal
          geregistreerd zakt een medicatie naar onderen.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500">Geen actieve medicatie.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map(({ room, scheduled, asNeeded }) => (
            <Card key={room} className="overflow-hidden">
              <div className="flex items-center gap-3 bg-brand-gradient-soft p-4 ring-1 ring-inset ring-rose-400/20">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                  <DoorOpen className="h-5 w-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold text-slate-100">{room}</span>
                  <span className="text-xs text-slate-500">
                    {scheduled.length + asNeeded.length} medicatie
                    {scheduled.length + asNeeded.length === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
              <CardContent className="flex flex-col gap-2 pt-3">
                {scheduled.map((row) => (
                  <MedicationRow key={row.medicationId} row={row} />
                ))}
                {asNeeded.length > 0 && (
                  <>
                    {scheduled.length > 0 && (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Indien nodig
                      </p>
                    )}
                    {asNeeded.map((row) => (
                      <MedicationRow key={row.medicationId} row={row} />
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {clientsWithoutMeds.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Geen actieve medicatie</h2>
          <div className="flex flex-col gap-2">
            {clientsWithoutMeds.map((client) => (
              <Link key={client.id} href={`/medicatie/${client.id}`}>
                <Card className="transition-colors hover:border-rose-500/50 hover:bg-surface2">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <span className="text-sm text-slate-300">{fullName(client)}</span>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MedicationRow({ row }: { row: MedicationOverviewRow }) {
  const badgeLabel = row.asNeeded ? "Indien nodig" : row.doneForToday ? "Klaar" : row.nextOpenTime;
  const badgeVariant = row.doneForToday ? "slate" : row.asNeeded ? "forest" : "rose";

  return (
    <Link href={`/medicatie/${row.clientId}`} className="block">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:border-rose-500/50",
          row.doneForToday ? "bg-surface2/20 opacity-60" : "bg-surface2/50"
        )}
      >
        <Badge variant={badgeVariant} className="shrink-0">
          {badgeLabel}
        </Badge>
        <div>
          <p className="text-sm text-slate-200">
            {row.medicationName} · {row.dosage}
          </p>
          <p className="text-xs text-slate-500">{row.clientName}</p>
        </div>
      </div>
    </Link>
  );
}
