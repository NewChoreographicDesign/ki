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
  const [reports, medicationChecks, todos, appointments, changeLog] = await Promise.all([
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
    // Also picks up a task that's been open since before this week (still
    // not completed) - not just ones created or completed within it -
    // since an unfinished recurring task stays relevant to every week it
    // remains open, and computeMissedTodosByDay() below needs its full
    // history to say which of THIS week's due days it was missed on.
    db.todo.findMany({
      where: {
        OR: [
          { completedAt: { gte: weekStart, lt: weekEnd } },
          { completed: false, createdAt: { lt: weekEnd } },
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
    // Accountability trail for corrections that need no special permission
    // to make: any staff member can edit a planned appointment (see
    // app/api/appointments/[id]/route.ts), and an admin can correct or
    // reset a medication check (see app/api/medication-checks/[id]/
    // route.ts). Neither is gatekept beyond that - what keeps both safe is
    // that every one of them lands here with who made it and what changed.
    db.auditLog.findMany({
      where: {
        createdAt: { gte: weekStart, lt: weekEnd },
        OR: [
          { targetType: "Appointment", action: { startsWith: "appointment.edited:" } },
          { targetType: "MedicationCheck", action: { startsWith: "medication-check.status-changed:" } },
          { targetType: "MedicationCheck", action: { startsWith: "medication-check.reset:" } },
        ],
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { weekStart, weekEnd, reports, medicationChecks, todos, appointments, changeLog };
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
 * Turns a raw audit-log action string into the human-readable line shown in
 * the weekrapport changelog — shared by the live view, .txt download, and
 * PDF archive so the three never drift into describing an edit differently.
 */
export function formatChangeLogDetail(action: string): string {
  if (action.startsWith("appointment.edited:")) {
    return action.slice("appointment.edited:".length);
  }
  if (action.startsWith("medication-check.status-changed:")) {
    const [from, to] = action.slice("medication-check.status-changed:".length).split("->");
    return `medicatiestatus ${STATUS_LABELS[from] ?? from} -> ${STATUS_LABELS[to] ?? to}`;
  }
  if (action.startsWith("medication-check.reset:")) {
    const from = action.slice("medication-check.reset:".length);
    return `medicatieregistratie verwijderd (was: ${STATUS_LABELS[from] ?? from})`;
  }
  return action;
}

/**
 * For every day of the week that's already happened (up to "now" for the
 * still-live current week), which scheduled Werklijst tasks were due and
 * hadn't been done by the end of that day. A task open across several of
 * its own scheduled days (never completed, or only completed on a later
 * one) shows up once per missed day rather than as a single vague "not
 * done" line, so a task skipped Monday and Wednesday but finally done
 * Friday reads as two separate misses, not one.
 */
export function computeMissedTodosByDay(
  todos: { daysOfWeek: string; createdAt: Date; completed: boolean; completedAt: Date | null; title: string }[],
  weekStart: Date,
  weekEnd: Date
): { dayLabel: string; dateLabel: string; titles: string[] }[] {
  const result: { dayLabel: string; dateLabel: string; titles: string[] }[] = [];

  for (let t = weekStart.getTime(); t < weekEnd.getTime(); t += 24 * 3_600_000) {
    const day = new Date(t);
    const dayEnd = new Date(t + 24 * 3_600_000);
    const weekday = todayDayOfWeek(day);

    const missed = todos.filter((todo) => {
      if (!parseDaysOfWeek(todo.daysOfWeek).includes(weekday)) return false;
      if (todo.createdAt >= dayEnd) return false; // didn't exist yet on this day
      if (todo.completed && todo.completedAt && todo.completedAt < dayEnd) return false; // done in time
      return true;
    });

    if (missed.length > 0) {
      result.push({ dayLabel: DAYS_OF_WEEK[weekday], dateLabel: formatDate(day), titles: missed.map((t) => t.title) });
    }
  }

  return result;
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
    const missedByDay = computeMissedTodosByDay(data.todos, data.weekStart, data.weekEnd);
    const done = data.todos.filter((t) => t.completed);
    if (missedByDay.length === 0) {
      add("Alle taken zijn op tijd afgerond.");
    } else {
      add("Niet gedaan, per dag:");
      for (const day of missedByDay) {
        add(`  ${day.dayLabel} ${day.dateLabel}`);
        for (const title of day.titles) {
          add(`    ${title}`);
        }
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
  add(`WIJZIGINGEN - changelog (${data.changeLog.length})`);
  add("-".repeat(60));
  if (data.changeLog.length === 0) {
    add("Geen wijzigingen aan afspraken of medicatieregistraties deze week.");
  } else {
    for (const e of data.changeLog) {
      add(`${formatDateTime(e.createdAt)} · door ${e.user?.name ?? "onbekend"} · ${formatChangeLogDetail(e.action)}`);
    }
  }

  return lines.join("\n");
}
