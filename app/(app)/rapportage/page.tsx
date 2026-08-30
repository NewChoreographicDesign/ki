import { db } from "@/lib/db";
import { determineShiftType } from "@/lib/auth";
import { fullName, formatDateTime, mostRecentThursdayStart } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

export default async function RapportagePage() {
  // "Recente rapportages" resets every Thursday: only reports from the most
  // recent Thursday onward are shown here. Nothing is deleted — this is a
  // display window, not a retention policy — so older reports stay in the
  // database and in whatever was already emailed out.
  const since = mostRecentThursdayStart();

  const [clients, reports] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.report.findMany({
      where: { createdAt: { gte: since } },
      include: { client: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, name: fullName(c) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Rapportage</h1>
        <p className="mt-1 text-slate-400">Verstuur een rapportage naar het algemene e-mailadres.</p>
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
        {reports.length === 0 ? (
          <p className="text-slate-500">Nog geen rapportages sinds afgelopen donderdag.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <span className="font-medium text-slate-200">{fullName(r.client)}</span>
                    <Badge variant={r.shift === "MORNING" ? "sky" : "emerald"}>
                      {r.shift === "MORNING" ? "Ochtend" : "Avond"}
                    </Badge>
                    <span>{formatDateTime(r.createdAt)}</span>
                    <span>&middot; {r.user.name}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-200">{r.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
