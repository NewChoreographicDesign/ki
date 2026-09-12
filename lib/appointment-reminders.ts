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

// Same reminder window as medicatie (lib/medication-reminders.ts): fires 5
// minutes ahead and keeps surfacing for an hour after, so a missed
// appointment keeps nagging rather than silently dropping off.
const REMIND_BEFORE_MIN = 5;
const STILL_SHOW_AFTER_MIN = 60;

export async function getDueAppointmentReminders(): Promise<DueAppointmentReminder[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - STILL_SHOW_AFTER_MIN * 60_000);
  const windowEnd = new Date(now.getTime() + REMIND_BEFORE_MIN * 60_000);

  const appointments = await db.appointment.findMany({
    where: { startAt: { gte: windowStart, lte: windowEnd } },
    include: { client: true },
  });

  return appointments
    .map((a) => ({
      appointmentId: a.id,
      title: a.title,
      clientId: a.clientId,
      clientName: a.client ? fullName(a.client) : null,
      startAt: a.startAt.toISOString(),
      minutesUntil: Math.round((a.startAt.getTime() - now.getTime()) / 60000),
    }))
    .sort((a, b) => a.minutesUntil - b.minutesUntil);
}
