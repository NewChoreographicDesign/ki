import "server-only";
import { db } from "@/lib/db";
import { mostRecentMondayStart, formatDate, formatDateTime, fullName } from "@/lib/utils";

/**
 * Replaces the old per-report/monthly emails: instead of pushing client data
 * out over email (see the removed lib/email.ts), admin/coordinator pull a
 * report covering the current week (reset every Monday, same "sinds
 * afgelopen <weekday>" pattern as rapportage's Thursday reset) from inside
 * the app when they want it.
 */
export async function getWeeklyReportData(now: Date = new Date()) {
  const weekStart = mostRecentMondayStart(now);

  const [reports, medicationChecks, todos, appointments] = await Promise.all([
    db.report.findMany({
      where: { createdAt: { gte: weekStart } },
      include: { client: true, user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.medicationCheck.findMany({
      where: { checkedAt: { gte: weekStart } },
      include: { medication: { include: { client: true } }, user: true },
      orderBy: { checkedAt: "asc" },
    }),
    db.todo.findMany({
      where: { OR: [{ createdAt: { gte: weekStart } }, { completedAt: { gte: weekStart } }] },
      include: { createdBy: true, completedBy: true },
      orderBy: { createdAt: "asc" },
    }),
    db.appointment.findMany({
      where: { startAt: { gte: weekStart } },
      include: { client: true, createdBy: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  return { weekStart, now, reports, medicationChecks, todos, appointments };
}

export type WeeklyReportData = Awaited<ReturnType<typeof getWeeklyReportData>>;

export function renderWeeklyReportText(data: WeeklyReportData): string {
  const lines: string[] = [];
  const add = (line = "") => lines.push(line);

  add(`WEEKRAPPORT — sinds ${formatDate(data.weekStart)}`);
  add(`Gegenereerd op ${formatDateTime(data.now)}`);
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
  add(`MEDICATIE AFGEVINKT (${data.medicationChecks.length})`);
  add("-".repeat(60));
  if (data.medicationChecks.length === 0) {
    add("Geen medicatie afgevinkt deze week.");
  } else {
    for (const c of data.medicationChecks) {
      add(
        `${formatDateTime(c.checkedAt)} · ${fullName(c.medication.client)} · ${c.medication.name} · door ${c.user.name}${c.comment ? ` · ${c.comment}` : ""}`
      );
    }
  }

  add("");
  add(`TO-DO'S (${data.todos.length})`);
  add("-".repeat(60));
  if (data.todos.length === 0) {
    add("Geen to-do's aangemaakt of afgerond deze week.");
  } else {
    for (const t of data.todos) {
      const status = t.completed ? `afgerond door ${t.completedBy?.name ?? "?"}` : "open";
      add(`${t.title} (${t.priority}) · ${status} · aangemaakt door ${t.createdBy.name}`);
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

  return lines.join("\n");
}
