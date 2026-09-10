import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { fullName, formatDateTime, mostRecentMondayStart, startOfToday, parseMedicationTimes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MedicationCheckForm } from "./medication-check-form";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; variant: "emerald" | "amber" | "red" }> = {
  TAKEN: { label: "Afgevinkt", variant: "emerald" },
  LEAVE: { label: "Verlof", variant: "amber" },
  NOT_TAKEN: { label: "Niet ingenomen", variant: "red" },
};

export default async function ClientMedicationPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  // "Laatste registraties" only shows the current week (since Monday) — the
  // full history isn't deleted, it just moves into the automatically
  // generated weekly PDF archive (see /weekrapport) once a week completes,
  // so this list starts fresh each week rather than growing forever.
  const weekStart = mostRecentMondayStart();
  const todayStart = startOfToday();
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      medications: {
        where: { active: true },
        include: {
          checks: {
            where: { checkedAt: { gte: weekStart } },
            include: { user: true },
            orderBy: { checkedAt: "desc" },
          },
        },
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/medicatie"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar cliënten
        </Link>
        <h1 className="text-2xl font-semibold text-slate-50">{fullName(client)}</h1>
        <p className="mt-1 text-slate-400">Medicatieoverzicht</p>
      </div>

      {client.medications.length === 0 ? (
        <p className="text-slate-500">Geen actieve medicatie voor deze cliënt.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {client.medications.map((med) => {
            const times = parseMedicationTimes(med.times);
            // A check isn't linked to a specific scheduled slot, so — same
            // heuristic as the reminder banner (lib/medication-reminders.ts)
            // — today's checks are paired against the sorted times in order:
            // the earliest check today "fills" the earliest time, and so on.
            const todaysChecksAsc = med.checks.filter((c) => c.checkedAt >= todayStart).slice().reverse();
            const slots = times.map((time, i) => ({ time, check: todaysChecksAsc[i] ?? null }));
            const allDoneToday = todaysChecksAsc.length >= times.length;

            return (
              <Card key={med.id}>
                <CardHeader>
                  <CardTitle>
                    {med.name} &middot; {med.dosage}
                  </CardTitle>
                  <CardDescription>
                    {med.instructions || "Geen extra instructies"} &middot; Tijden: {med.times}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-400">
                      <Clock className="h-3.5 w-3.5" /> Vandaag
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map(({ time, check }) => {
                        if (!check) {
                          return (
                            <Badge key={time} variant="slate">
                              {time} — nog open
                            </Badge>
                          );
                        }
                        const status = STATUS_LABELS[check.status] ?? STATUS_LABELS.TAKEN;
                        return (
                          <Badge key={time} variant={status.variant} className="animate-scale-in">
                            {time} — {status.label} ({check.user.name})
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  {allDoneToday ? (
                    <p className="text-sm text-slate-500">
                      Alle geplande tijden voor vandaag zijn geregistreerd. Dit blijft zo staan tot
                      morgen.
                    </p>
                  ) : (
                    <MedicationCheckForm
                      medicationId={med.id}
                      medicationName={med.name}
                      clientName={fullName(client)}
                    />
                  )}
                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-sm font-medium text-slate-400">Registraties deze week</p>
                    {med.checks.length === 0 ? (
                      <p className="text-sm text-slate-500">Nog niets geregistreerd deze week.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {med.checks.map((c) => {
                          const status = STATUS_LABELS[c.status] ?? STATUS_LABELS.TAKEN;
                          return (
                            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                              <Badge variant={status.variant}>{status.label}</Badge>
                              {formatDateTime(c.checkedAt)} &middot; {c.user.name}
                              {c.comment ? ` — ${c.comment}` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
