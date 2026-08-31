import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getSession, canAccessWeeklyReport } from "@/lib/auth";
import { getWeeklyReportData } from "@/lib/weekly-report";
import { formatDate, formatDateTime, fullName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function WeekrapportPage() {
  const session = await getSession();
  if (!session || !canAccessWeeklyReport(session.role)) {
    redirect("/dashboard");
  }

  const data = await getWeeklyReportData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Weekrapport</h1>
          <p className="mt-1 text-slate-400">
            Overzicht sinds {formatDate(data.weekStart)} (reset elke maandag). Vervangt de
            e-mails die vroeger automatisch werden verstuurd.
          </p>
        </div>
        <a href="/api/weekrapport/download">
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Downloaden (.txt)
          </Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rapportages ({data.reports.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.reports.length === 0 ? (
            <p className="text-slate-500">Geen rapportages deze week.</p>
          ) : (
            data.reports.map((r) => (
              <div key={r.id} className="rounded-lg bg-surface2 p-3 text-sm">
                <p className="text-slate-400">
                  {formatDate(r.date)} · {fullName(r.client)} · {r.shift === "MORNING" ? "Ochtend" : "Avond"} · door{" "}
                  {r.user.name}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-200">{r.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medicatie afgevinkt ({data.medicationChecks.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.medicationChecks.length === 0 ? (
            <p className="text-slate-500">Geen medicatie afgevinkt deze week.</p>
          ) : (
            data.medicationChecks.map((c) => (
              <p key={c.id} className="text-sm text-slate-300">
                {formatDateTime(c.checkedAt)} · {fullName(c.medication.client)} · {c.medication.name} · door{" "}
                {c.user.name}
                {c.comment ? ` · ${c.comment}` : ""}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">To-do&apos;s ({data.todos.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.todos.length === 0 ? (
            <p className="text-slate-500">Geen to-do&apos;s aangemaakt of afgerond deze week.</p>
          ) : (
            data.todos.map((t) => (
              <p key={t.id} className="text-sm text-slate-300">
                {t.title} ({t.priority}) ·{" "}
                {t.completed ? `afgerond door ${t.completedBy?.name ?? "?"}` : "open"} · aangemaakt door{" "}
                {t.createdBy.name}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Afspraken ({data.appointments.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.appointments.length === 0 ? (
            <p className="text-slate-500">Geen afspraken deze week.</p>
          ) : (
            data.appointments.map((a) => (
              <p key={a.id} className="text-sm text-slate-300">
                {formatDateTime(a.startAt)} · {a.title}
                {a.client ? ` · ${fullName(a.client)}` : ""} · aangemaakt door {a.createdBy.name}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
