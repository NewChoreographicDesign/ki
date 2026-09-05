import "server-only";
import { db } from "@/lib/db";

/**
 * Recreates every completed recurring to-do as a fresh, open copy for the
 * new week — called from the weekly cron (app/api/cron/weekly-report/
 * route.ts; bundled there rather than a separate cron entry since both
 * represent the same "start of a new week" rollover and Vercel's cron job
 * count is limited on the Hobby plan).
 *
 * `regenerated` guards against creating a duplicate if this ever runs twice
 * for the same completion: once a completed recurring to-do has spawned its
 * successor, it's marked regenerated and skipped on future runs. A to-do
 * left open (not completed) never regenerates — only a *completed*
 * recurring task produces next week's copy, per the feature request.
 */
export async function regenerateRecurringTodos(): Promise<{ regenerated: number }> {
  const toRegenerate = await db.todo.findMany({
    where: { recurring: true, completed: true, regenerated: false },
  });

  for (const todo of toRegenerate) {
    await db.$transaction([
      db.todo.create({
        data: {
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          dayOfWeek: todo.dayOfWeek,
          recurring: true,
          createdById: todo.createdById,
        },
      }),
      db.todo.update({ where: { id: todo.id }, data: { regenerated: true } }),
    ]);
  }

  return { regenerated: toRegenerate.length };
}
