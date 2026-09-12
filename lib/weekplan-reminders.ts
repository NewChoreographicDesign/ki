import "server-only";
import { db } from "@/lib/db";
import { amsterdamDate, getZonedParts, todayDayOfWeek, fullName, AMSTERDAM_TZ } from "@/lib/utils";

export type DueWeekPlanReminder = {
  weekPlanId: string;
  activity: string;
  clientId: string;
  clientName: string;
  time: string; // "HH:MM" (startTime)
  /** Negative once the scheduled time has passed (still surfaced as overdue). */
  minutesUntil: number;
};

// Same reminder window as medicatie/afspraken: fires 5 minutes ahead and
// keeps surfacing for an hour after.
const REMIND_BEFORE_MIN = 5;
const STILL_SHOW_AFTER_MIN = 60;

/**
 * Computes which of today's weekplanning blocks are currently "due", the
 * same way medicatie reminders work (lib/medication-reminders.ts): a
 * WeekPlan recurs on a weekday + time-of-day rather than an absolute date,
 * so today's occurrence is reconstructed from dayOfWeek/startTime rather
 * than read directly off a stored timestamp.
 */
export async function getDueWeekPlanReminders(): Promise<DueWeekPlanReminder[]> {
  const now = new Date();
  const weekday = todayDayOfWeek(now);
  const { year, month, day } = getZonedParts(now, AMSTERDAM_TZ);

  const plans = await db.weekPlan.findMany({
    where: { dayOfWeek: weekday, client: { active: true } },
    include: { client: true },
  });

  const due: DueWeekPlanReminder[] = [];
  for (const plan of plans) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(plan.startTime);
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) continue;

    const scheduled = amsterdamDate(year, month, day, hour, minute);
    const minutesUntil = Math.round((scheduled.getTime() - now.getTime()) / 60000);
    if (minutesUntil <= REMIND_BEFORE_MIN && minutesUntil >= -STILL_SHOW_AFTER_MIN) {
      due.push({
        weekPlanId: plan.id,
        activity: plan.activity,
        clientId: plan.clientId,
        clientName: fullName(plan.client),
        time: plan.startTime,
        minutesUntil,
      });
    }
  }

  return due.sort((a, b) => a.minutesUntil - b.minutesUntil);
}
