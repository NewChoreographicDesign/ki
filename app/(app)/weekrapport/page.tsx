import { redirect } from "next/navigation";
import { Download, Archive } from "lucide-react";
import { getSession, canAccessWeeklyReport } from "@/lib/auth";
import {
  getWeeklyReportData,
  groupMedicationChecksByDay,
  formatTodoDueLabel,
  formatAppointmentEditDetail,
} from "@/lib/weekly-report";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatTime, fullName, mostRecentMondayStart } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const MEDICATION_STATUS_LABELS: Record<string, string> = {
  TAKEN: "Afgevinkt",
  LEAVE: "Verlof",
  NOT_TAKEN: "Niet ingenomen",
};

export default async function WeekrapportPage() {
  const session = await getSession();
  if (!session || !canAccessWeeklyReport(session.role)) {
    redirect("/dashboard");
  }

  const weekStart = mostRecentMondayStart();
  const [data, archive] = await Promise.all([
    getWeeklyReportData(weekStart),
    db.weeklyReportPdf.findMany({
      orderBy: { weekStart: "desc" },
      select: { id: true, isoYear: true, isoWeek: true, weekStart: true, createdAt: true },
    }),
  ]);
  const todosNotDone = data.todos.filter((t) => !t.completed);
  const todosDone = data.todos.filter((t) => t.completed);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Weekrapport</h1>
        <p className="mt-1 text-slate-400">
          Vervangt de e-mails die vroeger automatisch werden verstuurd.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" /> Archief (automatisch, per kalenderweek)
          </CardTitle>
          <CardDescription>
            Elke maandagochtend wordt de afgelopen week automatisch vastgelegd als PDF — hierin
            staan alle acties van die week. PDF&apos;s worden 1 jaar bewaard; oudere worden
            automatisch verwijderd.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {archive.length === 0 ? (
            <p className="text-slate-500">
              Nog geen afgeronde week gearchiveerd — dat gebeurt vanaf de eerstvolgende maandag.
            </p>
          ) : (
            archive.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2"
              >
                <span className="text-sm text-slate-200">
                  Week {a.isoWeek}, {a.isoYear}{" "}
                  <span className="text-slate-500">({formatDate(a.weekStart)})</span>
                </span>
                <a href={`/api/weekrapport/archive/${a.id}`}>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </a>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Deze week (nog niet afgerond)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Live overzicht sinds {formatDate(data.weekStart)} — wordt aankomende maandag
            automatisch aan het archief hierboven toegevoegd.
          </p>
        </div>
        <a href="/api/weekrapport/download">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Voortgang (.txt)
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
          <CardTitle className="text-base">Medicatie ({data.medicationChecks.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.medicationChecks.length === 0 ? (
            <p className="text-slate-500">Geen medicatieregistraties deze week.</p>
          ) : (
            groupMedicationChecksByDay(data.medicationChecks).map((day) => (
              <div key={day.dateLabel}>
                <p className="mb-1.5 text-sm font-semibold text-slate-200">
                  {day.dayLabel} <span className="font-normal text-slate-500">{day.dateLabel}</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  {day.checks.map((c) => (
                    <p key={c.id} className="text-sm text-slate-300">
                      {formatTime(c.checkedAt)} · {fullName(c.medication.client)} · {c.medication.name} ·{" "}
                      {MEDICATION_STATUS_LABELS[c.status] ?? c.status} · door {c.user.name}
                      {c.comment ? ` · ${c.comment}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Werklijst ({data.todos.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.todos.length === 0 ? (
            <p className="text-slate-500">Geen taken aangemaakt of afgerond deze week.</p>
          ) : (
            <>
              {todosNotDone.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nog niet gedaan</p>
                  {todosNotDone.map((t) => (
                    <p key={t.id} className="text-sm text-slate-300">
                      {t.title} <span className="text-slate-500">· moest klaar zijn: {formatTodoDueLabel(t)}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-emerald-400">Alle taken zijn afgerond.</p>
              )}
              {todosDone.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Afgerond</p>
                  {todosDone.map((t) => (
                    <p key={t.id} className="text-sm text-slate-300">
                      {t.title} <span className="text-slate-500">· door {t.completedBy?.name ?? "?"}</span>
                    </p>
                  ))}
                </div>
              )}
            </>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wijzigingen agenda · changelog ({data.appointmentEdits.length})</CardTitle>
          <CardDescription>
            Iedereen mag een geplande afspraak corrigeren; hier staat wie wat heeft aangepast.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.appointmentEdits.length === 0 ? (
            <p className="text-slate-500">Geen wijzigingen aan afspraken deze week.</p>
          ) : (
            data.appointmentEdits.map((e) => (
              <p key={e.id} className="text-sm text-slate-300">
                {formatDateTime(e.createdAt)} · door {e.user?.name ?? "onbekend"} ·{" "}
                {formatAppointmentEditDetail(e.action)}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
