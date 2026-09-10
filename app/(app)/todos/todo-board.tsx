"use client";

import * as React from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DAYS_OF_WEEK } from "@/lib/utils";
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
  todayWeekday,
}: {
  initialOpen: TodoData[];
  initialCompleted: TodoData[];
  /** Admin-only: shows edit/delete controls on every task. */
  canManage?: boolean;
  /** 0 = Monday .. 6 = Sunday, see lib/utils.ts todayDayOfWeek(). */
  todayWeekday: number;
}) {
  const [open, setOpen] = React.useState(() => [...initialOpen].sort(sortByTime));
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [formOpen, setFormOpen] = React.useState(false);
  const [showWeek, setShowWeek] = React.useState(false);

  // A task with no day set has no day restriction, so it's always "due
  // today"; a task with days set is only shown here on one of those days —
  // the rest of the week it moves into the "Alle weektaken" dropdown below,
  // so the main list only ever shows what actually needs doing today.
  const dueToday = open.filter((t) => t.daysOfWeek.length === 0 || t.daysOfWeek.includes(todayWeekday));
  const otherDays = open.filter((t) => t.daysOfWeek.length > 0 && !t.daysOfWeek.includes(todayWeekday));

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
          <h2 className="text-lg font-semibold text-slate-100">Vandaag ({dueToday.length})</h2>
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

        {dueToday.length === 0 ? (
          <p className="text-slate-500">Geen taken voor vandaag.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dueToday.map((t) => (
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

        {otherDays.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowWeek((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showWeek ? "rotate-180" : ""}`} />
              Alle weektaken tonen ({otherDays.length})
            </button>
            {showWeek && (
              <div className="mt-3 flex flex-col gap-5">
                {DAYS_OF_WEEK.map((label, day) => {
                  if (day === todayWeekday) return null;
                  const tasksForDay = otherDays.filter((t) => t.daysOfWeek.includes(day));
                  if (tasksForDay.length === 0) return null;
                  return (
                    <div key={day}>
                      <h3 className="mb-2 text-sm font-semibold text-slate-400">{label}</h3>
                      <div className="flex flex-col gap-3">
                        {tasksForDay.map((t) => (
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
                    </div>
                  );
                })}
              </div>
            )}
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
  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
  const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
  if (byPriority !== 0) return byPriority;
  return a.createdAt.localeCompare(b.createdAt);
}
