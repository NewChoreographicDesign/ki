"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoForm } from "./todo-form";
import { TodoItem } from "./todo-item";
import type { TodoData } from "./todo-types";

// Open tasks are the whole point of this page, so they render first, right
// under the header — no full-height "add" form pushed above them pushing
// them below the fold. Adding one is a single tap on a compact trigger that
// expands the same form inline, and completing/creating updates this
// component's own state directly (see handleCreated/handleComplete below)
// instead of calling router.refresh(), which would re-run every query on
// the page for a second server round trip just to show one changed row.
export function TodoBoard({
  initialOpen,
  initialCompleted,
  canManage = false,
}: {
  initialOpen: TodoData[];
  initialCompleted: TodoData[];
  /** Admin-only: shows edit/delete controls on every task. */
  canManage?: boolean;
}) {
  const [open, setOpen] = React.useState(() => [...initialOpen].sort(sortByTime));
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [formOpen, setFormOpen] = React.useState(false);

  function handleCreated(todo: TodoData) {
    setOpen((prev) => [...prev, todo].sort(sortByTime));
    setFormOpen(false);
  }

  function handleUpdated(todo: TodoData) {
    setOpen((prev) => prev.map((t) => (t.id === todo.id ? todo : t)).sort(sortByTime));
  }

  function handleComplete(todo: TodoData) {
    setOpen((prev) => prev.filter((t) => t.id !== todo.id));
    setCompleted((prev) => [todo, ...prev].slice(0, 10));
  }

  function handleDelete(id: string) {
    setOpen((prev) => prev.filter((t) => t.id !== id));
    setCompleted((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Openstaand ({open.length})</h2>
          {!formOpen && (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nieuwe taak
            </Button>
          )}
        </div>

        {formOpen && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Nieuwe taak</CardTitle>
            </CardHeader>
            <CardContent>
              <TodoForm onSaved={handleCreated} onCancel={() => setFormOpen(false)} />
            </CardContent>
          </Card>
        )}

        {open.length === 0 ? (
          <p className="text-slate-500">Geen openstaande taken.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                canManage={canManage}
                onComplete={handleComplete}
                onUpdate={handleUpdated}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Recent afgerond</h2>
        {completed.length === 0 ? (
          <p className="text-slate-500">Nog niets afgerond.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {completed.map((t) => (
              <TodoItem key={t.id} todo={t} canManage={canManage} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Tasks with a scheduled time sort earliest-first; untimed tasks follow, by priority. */
function sortByTime(a: TodoData, b: TodoData): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
  if (byPriority !== 0) return byPriority;
  return a.createdAt.localeCompare(b.createdAt);
}
