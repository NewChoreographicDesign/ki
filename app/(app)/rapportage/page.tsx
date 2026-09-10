import { db } from "@/lib/db";
import { determineShiftType } from "@/lib/auth";
import { fullName, mostRecentThursdayStart } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportForm } from "./report-form";
import { ReportList, type ReportRow } from "./report-list";

export const dynamic = "force-dynamic";

export default async function RapportagePage() {
  // "Recente rapportages" resets every Thursday: only reports from the most
  // recent Thursday onward are shown here. Nothing is deleted — this is a
  // display window, not a retention policy — older reports stay in the
  // database and in the weekly PDF archive (see /weekrapport).
  const since = mostRecentThursdayStart();

  const [clients, reports] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.report.findMany({
      where: { createdAt: { gte: since } },
      include: { client: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, name: fullName(c), room: c.room }));

  const reportRows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    clientName: fullName(r.client),
    room: r.client.room || "Geen kamer",
    shift: r.shift,
    createdAt: r.createdAt.toISOString(),
    userName: r.user.name,
    content: r.content,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Rapportage</h1>
        <p className="mt-1 text-slate-400">
          Rapportage per cliënt en dienst — voor iedereen direct zichtbaar, geen e-mail nodig.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe rapportage</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportForm clients={clientOptions} defaultShift={determineShiftType()} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">
          Recente rapportages <span className="font-normal text-slate-500">(sinds donderdag)</span>
        </h2>
        <ReportList reports={reportRows} />
      </div>
    </div>
  );
}
