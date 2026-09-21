import "server-only";
import { db } from "@/lib/db";
import { mostRecentMondayStart, formatDate, formatDateTime, formatTime, fullName, todayDayOfWeek, DAYS_OF_WEEK, parseDaysOfWeek, shiftLabel, parseMedicationTimes } from "@/lib/utils";

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

/** One of WeeklyReportData["medicationChecks"], plus the scheduled time it was registered against — see groupMedicationChecksByDay. */
export type MedicationCheckWithSchedule = WeeklyReportData["medicationChecks"][number] & {
  /** The prescribed "HH:MM" slot this check fills, or null for an "indien nodig" (asNeeded) medication, which has no fixed schedule. */
  scheduledTime: string | null;
};

/**
 * Groups a week's medication checks by calendar day (Europe/Amsterdam), each
 * with a Dutch day name + date header, instead of one flat chronological
 * list — a week of multiple-times-a-day registrations across several
 * clients otherwise reads as an undifferentiated wall of lines. Checks are
 * already fetched in ascending checkedAt order, so groups come out in
 * chronological day order for free.
 *
 * Also pairs each check with the medication's OWN prescribed schedule
 * (Medication.times), not just the moment it was actually registered — the
 * weekrapport is meant to show whether medication went out on time, so
 * "checked at 08:15" on its own isn't enough without "due at 08:00" next to
 * it. Paired the same "Nth check of the day fills the Nth scheduled slot"
 * way lib/medication-schedule.ts#buildMedicationOverviewRow already pairs
 * them for the live Medicatie screen and reminder banner, so all three
 * places agree on which slot a given check belongs to. An asNeeded
 * medication has no fixed schedule, so scheduledTime is always null for it.
 */
export function groupMedicationChecksByDay(checks: WeeklyReportData["medicationChecks"]) {
  const groups: { dayLabel: string; dateLabel: string; checks: MedicationCheckWithSchedule[] }[] = [];
  const indexByDate = new Map<string, number>();
  // How many checks we've already placed today for each medication — reset
  // per calendar day (a fresh Map is created the first time a new date is
  // seen below), since the schedule itself repeats every day.
  const seenPerMedicationByDate = new Map<string, Map<string, number>>();

  for (const check of checks) {
    const dateLabel = formatDate(check.checkedAt);
    let index = indexByDate.get(dateLabel);
    if (index === undefined) {
      index = groups.length;
      indexByDate.set(dateLabel, index);
      groups.push({ dayLabel: DAYS_OF_WEEK[todayDayOfWeek(check.checkedAt)], dateLabel, checks: [] });
      seenPerMedicationByDate.set(dateLabel, new Map());
    }

    const seenPerMedication = seenPerMedicationByDate.get(dateLabel)!;
    const seenCount = seenPerMedication.get(check.medicationId) ?? 0;
    seenPerMedication.set(check.medicationId, seenCount + 1);

    const scheduledTimes = check.medication.asNeeded ? [] : parseMedicationTimes(check.medication.times);
    const scheduledTime = scheduledTimes[seenCount] ?? null;

    groups[index].checks.push({ ...check, scheduledTime });
  }
  return groups;
}

/**
 * Same grouping as groupMedicationChecksByDay(), but nested one level under
 * each client's room first — the shape the weekrapport's Medicatie section
 * actually needs: per room, per day, who gave (or didn't give) what. A
 * client with no room falls under "Geen kamer", sorted after real rooms
 * (alphabetically) same as the dashboard's "Vandaag per kamer" convention.
 */
export function groupMedicationChecksByRoomAndDay(checks: WeeklyReportData["medicationChecks"]) {
  const byRoom = new Map<string, WeeklyReportData["medicationChecks"]>();
  for (const check of checks) {
    const room = check.medication.client.room || "Geen kamer";
    const list = byRoom.get(room);
    if (list) list.push(check);
    else byRoom.set(room, [check]);
  }

  const rank = (room: string) => (room === "Geen kamer" ? 1 : 0);
  return Array.from(byRoom.entries())
    .map(([room, roomChecks]) => ({ room, days: groupMedicationChecksByDay(roomChecks) }))
    .sort((a, b) => rank(a.room) - rank(b.room) || a.room.localeCompare(b.room));
}

// The weekrapport's five sections, downloadable independently (see
// app/(app)/weekrapport/section-picker.tsx) — both the live .txt and an
// archived week's PDF can be filtered to just the ones asked for, while the
// automatically archived PDF itself (app/api/cron/weekly-report/route.ts)
// always keeps everything, since that's the permanent record.
export const WEEKLY_REPORT_SECTION_KEYS = ["reports", "medication", "todos", "appointments", "changelog"] as const;
export type WeeklyReportSection = (typeof WEEKLY_REPORT_SECTION_KEYS)[number];
const ALL_SECTIONS = new Set<WeeklyReportSection>(WEEKLY_REPORT_SECTION_KEYS);

/** Parses a comma-separated `?sections=` query value, ignoring unknown keys; empty/missing means "all". */
export function parseWeeklyReportSections(raw: string | null): Set<WeeklyReportSection> {
  if (!raw) return ALL_SECTIONS;
  const keys = raw.split(",").filter((k): k is WeeklyReportSection =>
    (WEEKLY_REPORT_SECTION_KEYS as readonly string[]).includes(k)
  );
  return keys.length > 0 ? new Set(keys) : ALL_SECTIONS;
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

export function renderWeeklyReportText(
  data: WeeklyReportData,
  sections: Set<WeeklyReportSection> = ALL_SECTIONS
): string {
  const lines: string[] = [];
  const add = (line = "") => lines.push(line);

  add(`WEEKRAPPORT — sinds ${formatDate(data.weekStart)}`);
  add(`Gegenereerd op ${formatDateTime(new Date())}`);
  add("=".repeat(60));

  if (sections.has("reports")) {
    add("");
    add(`RAPPORTAGES (${data.reports.length})`);
    add("-".repeat(60));
    if (data.reports.length === 0) {
      add("Geen rapportages deze week.");
    } else {
      for (const r of data.reports) {
        add(
          `${formatDate(r.date)} · ${fullName(r.client)} · ${shiftLabel(r.shift)} · door ${r.user.name}`
        );
        add(r.content);
        add("");
      }
    }
  }

  if (sections.has("medication")) {
    add("");
    add(`MEDICATIE (${data.medicationChecks.length})`);
    add("-".repeat(60));
    if (data.medicationChecks.length === 0) {
      add("Geen medicatieregistraties deze week.");
    } else {
      for (const room of groupMedicationChecksByRoomAndDay(data.medicationChecks)) {
        add(room.room);
        for (const day of room.days) {
          add(`  ${day.dayLabel} ${day.dateLabel}`);
          for (const c of day.checks) {
            const status = STATUS_LABELS[c.status] ?? c.status;
            const due = c.scheduledTime ? `Gepland ${c.scheduledTime}` : "Indien nodig";
            add(
              `    ${due} (geregistreerd ${formatTime(c.checkedAt)}) · ${fullName(c.medication.client)} · ${c.medication.name} · ${status} · door ${c.user.name}${c.comment ? ` · ${c.comment}` : ""}`
            );
          }
        }
        add("");
      }
    }
  }

  if (sections.has("todos")) {
    add("");
    add(`WERKLIJST (${data.todos.length})`);
    add("-".repeat(60));
    if (data.todos.length === 0) {
      add("Geen taken aangemaakt of afgerond deze week.");
    } else {
      const missedByDay = computeMissedTodosByDay(data.todos, data.weekStart, data.weekEnd);
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
    }
  }

  if (sections.has("appointments")) {
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
  }

  if (sections.has("changelog")) {
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
  }

  return lines.join("\n");
}
