import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession, determineShiftType } from "@/lib/auth";
import { fullName } from "@/lib/utils";
import { isWithinReportAuthorWindow, REPORT_AUTHOR_WINDOW_MS } from "@/lib/report-window";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportForm } from "./report-form";
import { ReportList, type ReportRow } from "./report-list";

export const dynamic = "force-dynamic";

export default async function RapportagePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === Role.ADMIN;
  // Every rapportage is admin-only from creation (see Report.adminOnly's
  // schema.prisma comment) — the one exception is the author's own recent
  // window (lib/report-window.ts), which is also how long they can still
  // adjust it. ADMIN instead gets the usual rolling 7-day "everything"
  // view: a fixed reset (e.g. every Thursday at midnight) would make the
  // list go empty right at the reset moment, which reads as broken even
  // though it's working as designed. Nothing is deleted either way — this
  // is a display window, not a retention policy — older reports stay in
  // the database and in the weekly PDF archive (see /weekrapport).
  const authorWindowStart = new Date(Date.now() - REPORT_AUTHOR_WINDOW_MS);
  const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [clients, reports] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    db.report.findMany({
      where: isAdmin
        ? { createdAt: { gte: since7Days } }
        : { userId: session.sub, createdAt: { gte: authorWindowStart } },
      include: { client: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, name: fullName(c), room: c.room }));

  const reportRows: ReportRow[] = reports.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: fullName(r.client),
    room: r.client.room || "Geen kamer",
    shift: r.shift,
    date: r.date.toISOString(),
    createdAt: r.createdAt.toISOString(),
    userName: r.user.name,
    content: r.content,
    editable: r.userId === session.sub && isWithinReportAuthorWindow(r.createdAt),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Rapportage</h1>
        <p className="mt-1 text-slate-400">
          Rapportage per cliënt en dienst, geen e-mail nodig. Alleen zichtbaar voor de beheerder —
          je eigen rapportage kun je zelf nog 25 uur terugzien en aanpassen.
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
          {isAdmin ? (
            <>
              Recente rapportages <span className="font-normal text-slate-500">(laatste 7 dagen)</span>
            </>
          ) : (
            <>
              Jouw rapportages <span className="font-normal text-slate-500">(laatste 25 uur)</span>
            </>
          )}
        </h2>
        <ReportList
          reports={reportRows}
          clients={clientOptions}
          emptyMessage={
            isAdmin
              ? "Nog geen rapportages in de afgelopen 7 dagen."
              : "Je hebt geen rapportages van de afgelopen 25 uur — oudere rapportages zijn alleen nog voor de beheerder zichtbaar."
          }
        />
      </div>
    </div>
  );
}
