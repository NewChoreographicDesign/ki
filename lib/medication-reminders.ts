import "server-only";
import { db } from "@/lib/db";
import { amsterdamDate, getZonedParts, startOfToday, fullName, parseMedicationTimes, AMSTERDAM_TZ } from "@/lib/utils";

export type DueReminder = {
  medicationId: string;
  medicationName: string;
  clientId: string;
  clientName: string;
  time: string; // "HH:MM"
  /** Negative once the scheduled time has passed (still surfaced as overdue). */
  minutesUntil: number;
};

// Fires 5 minutes ahead of a scheduled dose, per the feature request, and
// keeps surfacing it for a while after the exact time passes rather than
// silently dropping it the instant it's missed — a missed medication is
// exactly the kind of thing that should keep nagging until acknowledged.
const REMIND_BEFORE_MIN = 5;
const STILL_SHOW_AFTER_MIN = 60;

/**
 * Computes which scheduled medication times are currently "due" (within the
 * reminder window) for active medications on active clients.
 *
 * Medication.times ("08:00,20:00") isn't linked to specific MedicationCheck
 * rows — a check just records when someone acted, not which scheduled slot
 * it was for. This approximates the match by pairing today's checks against
 * the medication's sorted times in order: the first check "consumes" the
 * earliest time, the second the next, and so on. Once enough checks exist
 * today to cover every scheduled time, nothing for that medication is due —
 * good enough for a real-time reminder (not a compliance record; the actual
 * check history is unaffected by this heuristic).
 */
export async function getDueMedicationReminders(): Promise<DueReminder[]> {
  const now = new Date();
  const todayStart = startOfToday();
  const { year, month, day } = getZonedParts(now, AMSTERDAM_TZ);

  const medications = await db.medication.findMany({
    where: { active: true, client: { active: true } },
    include: {
      client: true,
      checks: { where: { checkedAt: { gte: todayStart } } },
    },
  });

  const due: DueReminder[] = [];
  for (const med of medications) {
    const times = parseMedicationTimes(med.times);
    const pendingTimes = times.slice(med.checks.length);

    for (const time of pendingTimes) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (!match) continue;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour > 23 || minute > 59) continue;

      const scheduled = amsterdamDate(year, month, day, hour, minute);
      const minutesUntil = Math.round((scheduled.getTime() - now.getTime()) / 60000);
      if (minutesUntil <= REMIND_BEFORE_MIN && minutesUntil >= -STILL_SHOW_AFTER_MIN) {
        due.push({
          medicationId: med.id,
          medicationName: med.name,
          clientId: med.clientId,
          clientName: fullName(med.client),
          time,
          minutesUntil,
        });
      }
    }
  }

  return due.sort((a, b) => a.minutesUntil - b.minutesUntil);
}
