import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";

export type DueAppointmentReminder = {
  appointmentId: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  startAt: string; // ISO
  /** Negative once the scheduled time has passed (still surfaced as overdue). */
  minutesUntil: number;
};

// Same default lead as medicatie (lib/medication-reminders.ts): 5 minutes
// ahead when the afspraak has no remindMinutes of its own (see the Agenda's
// reminder picker — AGENDA_REMINDER_OPTIONS in lib/agenda-shared.ts, up to a
// day ahead), and keeps surfacing for an hour after, so a missed afspraak
// keeps nagging rather than silently dropping off.
const REMIND_BEFORE_MIN = 5;
const STILL_SHOW_AFTER_MIN = 60;
// Widest the query window needs to be: the longest remindMinutes option
// (1 dag) plus the window it then keeps showing for.
const MAX_LEAD_MIN = 1440;

export async function getDueAppointmentReminders(): Promise<DueAppointmentReminder[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - STILL_SHOW_AFTER_MIN * 60_000);
  const windowEnd = new Date(now.getTime() + MAX_LEAD_MIN * 60_000);

  const appointments = await db.appointment.findMany({
    where: { startAt: { gte: windowStart, lte: windowEnd }, status: "PLANNED" },
    include: { client: true },
  });

  return appointments
    .filter((a) => a.remindMinutes !== 0) // 0 = "geen herinnering"
    .map((a) => ({
      appointmentId: a.id,
      title: a.title,
      clientId: a.clientId,
      clientName: a.client ? fullName(a.client) : null,
      startAt: a.startAt.toISOString(),
      minutesUntil: Math.round((a.startAt.getTime() - now.getTime()) / 60000),
      leadMin: a.remindMinutes ?? REMIND_BEFORE_MIN,
    }))
    .filter((a) => a.minutesUntil <= a.leadMin && a.minutesUntil >= -STILL_SHOW_AFTER_MIN)
    .map(({ leadMin, ...rest }) => rest)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);
}
