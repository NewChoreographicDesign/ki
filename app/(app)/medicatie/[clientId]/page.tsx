import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fullName, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MedicationCheckForm } from "./medication-check-form";

export const dynamic = "force-dynamic";

export default async function ClientMedicationPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      medications: {
        where: { active: true },
        include: { checks: { include: { user: true }, orderBy: { checkedAt: "desc" }, take: 5 } },
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">{fullName(client)}</h1>
        <p className="mt-1 text-slate-400">Medicatieoverzicht</p>
      </div>

      {client.medications.length === 0 ? (
        <p className="text-slate-500">Geen actieve medicatie voor deze cliënt.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {client.medications.map((med) => (
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
                <MedicationCheckForm medicationId={med.id} />
                {med.checks.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-sm font-medium text-slate-400">Laatste registraties</p>
                    <ul className="flex flex-col gap-1.5">
                      {med.checks.map((c) => (
                        <li key={c.id} className="text-sm text-slate-400">
                          {formatDateTime(c.checkedAt)} &middot; {c.user.name}
                          {c.comment ? ` — ${c.comment}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
