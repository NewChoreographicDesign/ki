import { redirect } from "next/navigation";
import { getSession, canAccessWeeklyReport } from "@/lib/auth";
import {
  getWeeklyReportData,
  groupMedicationChecksByRoomAndDay,
  computeMissedTodosByDay,
  formatChangeLogDetail,
} from "@/lib/weekly-report";
import { db } from "@/lib/db";
import { backfillMissingWeeklyReports } from "@/lib/weekly-report-archive";
import { formatDate, formatDateTime, formatTime, fullName, mostRecentMondayStart, shiftLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WeekrapportDownloads } from "./section-picker";

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
  const archiveSelect = { id: true, isoYear: true, isoWeek: true, weekStart: true, createdAt: true } as const;
  const [data, archive] = await Promise.all([
    getWeeklyReportData(weekStart),
    db.weeklyReportPdf.findMany({ orderBy: { weekStart: "desc" }, select: archiveSelect }),
  ]);

  // The Monday cron (app/api/cron/weekly-report/route.ts) can miss a week
  // (a misconfigured secret, a skipped trigger) with no retry of its own —
  // this fills any gap in on the next page load instead of leaving that
  // week's archive gone for good. See lib/weekly-report-archive.ts.
  const created = await backfillMissingWeeklyReports(archive);
  const finalArchive = created > 0
    ? await db.weeklyReportPdf.findMany({ orderBy: { weekStart: "desc" }, select: archiveSelect })
    : archive;

  const missedByDay = computeMissedTodosByDay(data.todos, data.weekStart, data.weekEnd);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Weekrapport</h1>
        <p className="mt-1 text-slate-400">
          Vervangt de e-mails die vroeger automatisch werden verstuurd.
        </p>
      </div>

      <WeekrapportDownloads
        archive={finalArchive.map((a) => ({
          id: a.id,
          isoYear: a.isoYear,
          isoWeek: a.isoWeek,
          weekStart: a.weekStart.toISOString(),
        }))}
        weekStartLabel={formatDate(data.weekStart)}
      />

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
                  {formatDate(r.date)} · {fullName(r.client)} · {shiftLabel(r.shift)} · door{" "}
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
        <CardContent className="flex flex-col gap-5">
          {data.medicationChecks.length === 0 ? (
            <p className="text-slate-500">Geen medicatieregistraties deze week.</p>
          ) : (
            groupMedicationChecksByRoomAndDay(data.medicationChecks).map((room) => (
              <div key={room.room}>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-400">{room.room}</p>
                <div className="flex flex-col gap-3 border-l border-border pl-4">
                  {room.days.map((day) => (
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
          ) : missedByDay.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Niet gedaan, per dag</p>
              {missedByDay.map((day) => (
                <div key={day.dateLabel}>
                  <p className="text-sm font-medium text-slate-200">
                    {day.dayLabel} <span className="font-normal text-slate-500">{day.dateLabel}</span>
                  </p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {day.titles.map((title, i) => (
                      <p key={i} className="text-sm text-slate-300">
                        {title}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-forest-400">Alle taken zijn op tijd afgerond.</p>
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
          <CardTitle className="text-base">Wijzigingen · changelog ({data.changeLog.length})</CardTitle>
          <CardDescription>
            Correcties die geen speciale rechten vereisen: iedereen mag een geplande afspraak
            aanpassen, een beheerder mag een medicatiestatus corrigeren of een registratie
            resetten. Hier staat wie wat heeft aangepast.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.changeLog.length === 0 ? (
            <p className="text-slate-500">Geen wijzigingen aan afspraken of medicatieregistraties deze week.</p>
          ) : (
            data.changeLog.map((e) => (
              <p key={e.id} className="text-sm text-slate-300">
                {formatDateTime(e.createdAt)} · door {e.user?.name ?? "onbekend"} · {formatChangeLogDetail(e.action)}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
