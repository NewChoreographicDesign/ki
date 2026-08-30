import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TodoForm } from "./todo-form";
import { TodoItem, type TodoData } from "./todo-item";

export const dynamic = "force-dynamic";

function serialize(todo: {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  completed: boolean;
  completedBy: { name: string } | null;
  completedAt: Date | null;
  completionNote: string | null;
  createdBy: { name: string };
  createdAt: Date;
}): TodoData {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    completed: todo.completed,
    completedByName: todo.completedBy?.name ?? null,
    completedAt: todo.completedAt ? todo.completedAt.toISOString() : null,
    completionNote: todo.completionNote,
    createdByName: todo.createdBy.name,
    createdAt: todo.createdAt.toISOString(),
  };
}

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
          Maandelijks wordt een overzicht naar de coördinator gestuurd.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Openstaand ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-slate-500">Geen openstaande taken.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((t) => (
              <TodoItem key={t.id} todo={serialize(t)} />
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe taak</CardTitle>
        </CardHeader>
        <CardContent>
          <TodoForm />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Recent afgerond</h2>
        {completed.length === 0 ? (
          <p className="text-slate-500">Nog niets afgerond.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {completed.map((t) => (
              <TodoItem key={t.id} todo={serialize(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
