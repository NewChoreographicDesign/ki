import "server-only";
import { db } from "@/lib/db";
import { mostRecentMondayStart, formatDate, formatDateTime, formatTime, fullName, todayDayOfWeek, DAYS_OF_WEEK, parseDaysOfWeek } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  TAKEN: "Afgevinkt",
  LEAVE: "Verlof",
  NOT_TAKEN: "Niet ingenomen",
};

/**
 * Replaces the old per-report/monthly emails: instead of pushing client data
 * out over email (see the removed lib/email.ts), admin/coordinator pull a
 * report covering a given week from inside the app. Used two ways:
 * - Live/in-progress current week: getWeeklyReportData(mostRecentMondayStart())
 *   with weekEnd defaulting to "now".
 * - A specific, already-completed week (the automatic PDF archive, see
 *   app/api/cron/weekly-report/route.ts): pass an explicit weekEnd so next
 *   week's data can't leak into an archived week's PDF.
 */
export async function getWeeklyReportData(weekStart: Date, weekEnd: Date = new Date()) {
  const [reports, medicationChecks, todos, appointments, appointmentEdits] = await Promise.all([
    db.report.findMany({
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
      include: { client: true, user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.medicationCheck.findMany({
      where: { checkedAt: { gte: weekStart, lt: weekEnd } },
      include: { medication: { include: { client: true } }, user: true },
      orderBy: { checkedAt: "asc" },
    }),
    db.todo.findMany({
      where: {
        OR: [
          { createdAt: { gte: weekStart, lt: weekEnd } },
          { completedAt: { gte: weekStart, lt: weekEnd } },
        ],
      },
      include: { createdBy: true, completedBy: true },
      orderBy: { createdAt: "asc" },
    }),
    db.appointment.findMany({
      where: { startAt: { gte: weekStart, lt: weekEnd } },
      include: { client: true, createdBy: true },
      orderBy: { startAt: "asc" },
    }),
    // Any staff member can edit a planned appointment (see
    // app/api/appointments/[id]/route.ts) - this is the changelog that
    // makes that safe: every edit lands here with who made it and what
    // changed, even though the edit itself needed no special permission.
    db.auditLog.findMany({
      where: {
        targetType: "Appointment",
        action: { startsWith: "appointment.edited:" },
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { weekStart, weekEnd, reports, medicationChecks, todos, appointments, appointmentEdits };
}

export type WeeklyReportData = Awaited<ReturnType<typeof getWeeklyReportData>>;

/**
 * Groups a week's medication checks by calendar day (Europe/Amsterdam), each
 * with a Dutch day name + date header, instead of one flat chronological
 * list — a week of multiple-times-a-day registrations across several
 * clients otherwise reads as an undifferentiated wall of lines. Checks are
 * already fetched in ascending checkedAt order, so groups come out in
 * chronological day order for free.
 */
export function groupMedicationChecksByDay(checks: WeeklyReportData["medicationChecks"]) {
  const groups: { dayLabel: string; dateLabel: string; checks: WeeklyReportData["medicationChecks"] }[] = [];
  const indexByDate = new Map<string, number>();
  for (const check of checks) {
    const dateLabel = formatDate(check.checkedAt);
    let index = indexByDate.get(dateLabel);
    if (index === undefined) {
      index = groups.length;
      indexByDate.set(dateLabel, index);
      groups.push({ dayLabel: DAYS_OF_WEEK[todayDayOfWeek(check.checkedAt)], dateLabel, checks: [] });
    }
    groups[index].checks.push(check);
  }
  return groups;
}

/**
 * "Wanneer had dit klaar moeten zijn?" for a not-yet-done Werklijst task —
 * shared by the live web view, the .txt download, and the archived PDF so
 * the three surfaces never drift into describing the same task differently.
 */
const APPOINTMENT_EDIT_PREFIX = "appointment.edited:";

/** Strips the audit-log action prefix, leaving just the human-readable diff. */
export function formatAppointmentEditDetail(action: string): string {
  return action.startsWith(APPOINTMENT_EDIT_PREFIX) ? action.slice(APPOINTMENT_EDIT_PREFIX.length) : action;
}

export function formatTodoDueLabel(todo: { daysOfWeek: string; time: string | null }): string {
  const days = parseDaysOfWeek(todo.daysOfWeek);
  const dayLabel = days.length === 0 ? "" : days.length === 7 ? "elke dag" : days.map((d) => DAYS_OF_WEEK[d]).join(", ");
  const parts = [dayLabel, todo.time ?? ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "geen vaste dag/tijd";
}

export function renderWeeklyReportText(data: WeeklyReportData): string {
  const lines: string[] = [];
  const add = (line = "") => lines.push(line);

  add(`WEEKRAPPORT — sinds ${formatDate(data.weekStart)}`);
  add(`Gegenereerd op ${formatDateTime(new Date())}`);
  add("=".repeat(60));

  add("");
  add(`RAPPORTAGES (${data.reports.length})`);
  add("-".repeat(60));
  if (data.reports.length === 0) {
    add("Geen rapportages deze week.");
  } else {
    for (const r of data.reports) {
      add(
        `${formatDate(r.date)} · ${fullName(r.client)} · ${r.shift === "MORNING" ? "Ochtend" : "Avond"} · door ${r.user.name}`
      );
      add(r.content);
      add("");
    }
  }

  add("");
  add(`MEDICATIE (${data.medicationChecks.length})`);
  add("-".repeat(60));
  if (data.medicationChecks.length === 0) {
    add("Geen medicatieregistraties deze week.");
  } else {
    for (const day of groupMedicationChecksByDay(data.medicationChecks)) {
      add(`${day.dayLabel} ${day.dateLabel}`);
      for (const c of day.checks) {
        const status = STATUS_LABELS[c.status] ?? c.status;
        add(
          `  ${formatTime(c.checkedAt)} · ${fullName(c.medication.client)} · ${c.medication.name} · ${status} · door ${c.user.name}${c.comment ? ` · ${c.comment}` : ""}`
        );
      }
      add("");
    }
  }

  add("");
  add(`WERKLIJST (${data.todos.length})`);
  add("-".repeat(60));
  if (data.todos.length === 0) {
    add("Geen taken aangemaakt of afgerond deze week.");
  } else {
    const notDone = data.todos.filter((t) => !t.completed);
    const done = data.todos.filter((t) => t.completed);
    if (notDone.length === 0) {
      add("Alle taken zijn afgerond.");
    } else {
      add("Nog niet gedaan:");
      for (const t of notDone) {
        add(`  ${t.title} · moest klaar zijn: ${formatTodoDueLabel(t)}`);
      }
    }
    if (done.length > 0) {
      add("");
      add("Afgerond:");
      for (const t of done) {
        add(`  ${t.title} · door ${t.completedBy?.name ?? "?"}`);
      }
    }
  }

  add("");
  add(`AFSPRAKEN (${data.appointments.length})`);
  add("-".repeat(60));
  if (data.appointments.length === 0) {
    add("Geen afspraken deze week.");
  } else {
    for (const a of data.appointments) {
      add(
        `${formatDateTime(a.startAt)} · ${a.title}${a.client ? ` · ${fullName(a.client)}` : ""} · aangemaakt door ${a.createdBy.name}`
      );
    }
  }

  add("");
  add(`WIJZIGINGEN AGENDA - changelog (${data.appointmentEdits.length})`);
  add("-".repeat(60));
  if (data.appointmentEdits.length === 0) {
    add("Geen wijzigingen aan afspraken deze week.");
  } else {
    for (const e of data.appointmentEdits) {
      add(`${formatDateTime(e.createdAt)} · door ${e.user?.name ?? "onbekend"} · ${formatAppointmentEditDetail(e.action)}`);
    }
  }

  return lines.join("\n");
}
