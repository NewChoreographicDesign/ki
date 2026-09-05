import { db } from "@/lib/db";
import { serializeTodo } from "./todo-types";
import { TodoBoard } from "./todo-board";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
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
          Voor iedereen zichtbaar. Terugkerende taken verschijnen automatisch weer volgende week.
        </p>
      </div>

      <TodoBoard initialOpen={open.map(serializeTodo)} initialCompleted={completed.map(serializeTodo)} />
    </div>
  );
}
