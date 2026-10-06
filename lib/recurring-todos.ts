import "server-only";
import { db } from "@/lib/db";
import { todayDayOfWeek, todayCalendarDate, startOfToday, parseDaysOfWeek, formatDaysOfWeek, isTodoDueToday } from "@/lib/utils";

/**
 * Reopens completed recurring to-do's whose next scheduled day has arrived
 * — either a daysOfWeek match, or (for an interval-based task, see
 * Todo.intervalDays's own comment) a day that lands on the fixed
 * intervalDays/intervalAnchorDate cycle. Called from the Todos page itself
 * (app/(app)/todos/page.tsx) on every load rather than from a cron: a task
 * can recur on any subset of days (daily, or just Mon/Wed/Fri, or every
 * 3rd day, ...), so "once a week" cron timing can't correctly time this —
 * checking on each page view, which happens many times a day in real use,
 * keeps it close to real-time without needing a cron slot Vercel's Hobby
 * plan doesn't have room for.
 *
 * A completed recurring to-do regenerates once it's due again (by either
 * pattern) AND it was completed on an earlier day (never the same day it
 * was just completed — otherwise a Mon/Wed/Fri task completed on Monday
 * would immediately spawn another copy for Monday). `regenerated` then
 * guards against creating a second copy if this runs again later the same
 * day. isTodoDueToday's own showUntil check means a task past that cutoff
 * (an intervention-plan task whose plan is now due for evaluation) simply
 * stops regenerating here — no separate "is this plan still active" check
 * needed.
 */
export async function regenerateRecurringTodos(): Promise<{ regenerated: number }> {
  const today = startOfToday();
  const todayCalendar = todayCalendarDate();
  const todayWeekday = todayDayOfWeek();

  const candidates = await db.todo.findMany({
    where: { recurring: true, completed: true, regenerated: false, completedAt: { lt: today } },
  });

  const due = candidates.filter((todo) =>
    isTodoDueToday(
      { daysOfWeek: parseDaysOfWeek(todo.daysOfWeek), intervalDays: todo.intervalDays, intervalAnchorDate: todo.intervalAnchorDate, showUntil: todo.showUntil },
      todayCalendar,
      todayWeekday
    )
  );

  for (const todo of due) {
    await db.$transaction([
      db.todo.create({
        data: {
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          daysOfWeek: formatDaysOfWeek(parseDaysOfWeek(todo.daysOfWeek)),
          // The interval cycle stays anchored to its original start day,
          // never reset to "today" — see Todo.intervalAnchorDate's comment.
          intervalDays: todo.intervalDays,
          intervalAnchorDate: todo.intervalAnchorDate,
          showUntil: todo.showUntil,
          interventionPlanId: todo.interventionPlanId,
          time: todo.time,
          recurring: true,
          createdById: todo.createdById,
          assignedToId: todo.assignedToId,
          room: todo.room,
        },
      }),
      db.todo.update({ where: { id: todo.id }, data: { regenerated: true } }),
    ]);
  }

  return { regenerated: due.length };
}
