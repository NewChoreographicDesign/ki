import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayDayOfWeek } from "@/lib/utils";
import { serializeTodo } from "./todo-types";
import { TodoBoard } from "./todo-board";
import { regenerateRecurringTodos } from "@/lib/recurring-todos";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const session = await getSession();

  // Cheap idempotent check on every load rather than a cron — see
  // lib/recurring-todos.ts for why a once-a-week (or even once-a-day) cron
  // can't correctly time a task that recurs on an arbitrary set of days.
  await regenerateRecurringTodos();

  const [open, completed] = await Promise.all([
    db.todo.findMany({
      where: { completed: false },
      include: { createdBy: true, completedBy: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    db.todo.findMany({
      where: { completed: true },
      include: { createdBy: true, completedBy: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">To-Do&apos;s</h1>
        <p className="mt-1 text-slate-400">
          Voor iedereen zichtbaar, gesorteerd op tijd. Taken voor een andere dag staan onder
          &quot;Alle weektaken&quot;. Terugkerende taken verschijnen automatisch weer open op de
          volgende geplande dag.
        </p>
      </div>

      <TodoBoard
        initialOpen={open.map(serializeTodo)}
        initialCompleted={completed.map(serializeTodo)}
        canManage={session?.role === "ADMIN"}
        todayWeekday={todayDayOfWeek()}
      />
    </div>
  );
}
