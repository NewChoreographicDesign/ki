import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReportDataBreach, isDataBreachOverdue } from "@/lib/data-breach";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatalekForm } from "./datalek-form";
import { DatalekCaseList, type DatalekRow } from "./datalek-case-list";

export const dynamic = "force-dynamic";

// The AVG (GDPR) "melding datalek" duty — reporting is open to every
// non-invaller role, AVG-timeline management (assess → AP-melding →
// betrokkenen informeren → afsluiten) is admin-only.
export default async function DatalekPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canReportDataBreach(session.role)) redirect("/dashboard");

  const incidents = await db.dataBreachIncident.findMany({
    orderBy: { detectedAt: "desc" },
    take: 200,
  });

  const rows: DatalekRow[] = incidents.map((i) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    status: i.status,
    detectedAt: i.detectedAt.toISOString(),
    affectedPersonsEstimate: i.affectedPersonsEstimate,
    likelyRisk: i.likelyRisk,
    overdue: isDataBreachOverdue(i),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Datalekken</h1>
        <p className="mt-1 text-slate-400">
          Meld een (mogelijk) datalek direct — de beheerders worden meteen gewaarschuwd, los van
          de gewone meldingen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Protocol in het kort</CardTitle>
          <CardDescription>Volledige procedure: zie het datalekprotocol van de organisatie.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Meld het datalek direct hieronder, ook bij twijfel — liever een keer te veel.</li>
            <li>
              Een beheerder beoordeelt binnen 24 uur of er een waarschijnlijk risico is voor de
              betrokkenen (AVG art. 33).
            </li>
            <li>
              Is dat risico waarschijnlijk, dan meldt de organisatie het datalek binnen{" "}
              <strong>72 uur na ontdekking</strong> bij de Autoriteit Persoonsgegevens.
            </li>
            <li>
              Bij een hoog risico voor de betrokkenen worden zij ook zelf geïnformeerd (AVG art.
              34).
            </li>
            <li>De zaak wordt afgesloten met een korte samenvatting van wat is ondernomen.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nieuw datalek melden</CardTitle>
        </CardHeader>
        <CardContent>
          <DatalekForm />
        </CardContent>
      </Card>

      <DatalekCaseList incidents={rows} />
    </div>
  );
}
