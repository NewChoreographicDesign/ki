import "server-only";
import { db } from "@/lib/db";
import { todayDayOfWeek, startOfToday, parseDaysOfWeek, formatDaysOfWeek } from "@/lib/utils";

/**
 * Reopens completed recurring to-do's whose next scheduled day has arrived.
 * Called from the Todos page itself (app/(app)/todos/page.tsx) on every
 * load rather than from a cron: a task can recur on any subset of days
 * (daily, or just Mon/Wed/Fri, ...), so "once a week" cron timing can't
 * correctly time this — checking on each page view, which happens many
 * times a day in real use, keeps it close to real-time without needing a
 * cron slot Vercel's Hobby plan doesn't have room for.
 *
 * A completed recurring to-do regenerates once its `daysOfWeek` includes
 * today AND it was completed on an earlier day (never the same day it was
 * just completed — otherwise a Mon/Wed/Fri task completed on Monday would
 * immediately spawn another copy for Monday). `regenerated` then guards
 * against creating a second copy if this runs again later the same day.
 */
export async function regenerateRecurringTodos(): Promise<{ regenerated: number }> {
  const today = startOfToday();
  const todayWeekday = todayDayOfWeek();

  const candidates = await db.todo.findMany({
    where: { recurring: true, completed: true, regenerated: false, completedAt: { lt: today } },
  });

  const due = candidates.filter((todo) => parseDaysOfWeek(todo.daysOfWeek).includes(todayWeekday));

  for (const todo of due) {
    await db.$transaction([
      db.todo.create({
        data: {
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          daysOfWeek: formatDaysOfWeek(parseDaysOfWeek(todo.daysOfWeek)),
          time: todo.time,
          recurring: true,
          createdById: todo.createdById,
        },
      }),
      db.todo.update({ where: { id: todo.id }, data: { regenerated: true } }),
    ]);
  }

  return { regenerated: due.length };
}
