"use client";

import * as React from "react";
import { ChevronDown, Plus, ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoForm } from "../todos/todo-form";
import { TodoItem } from "../todos/todo-item";
import { sortByTime } from "../todos/todo-board";
import type { TodoData } from "../todos/todo-types";

/**
 * A personal to-do list for the logged-in medewerker — separate from the
 * shared, everyone-sees-it Werklijst. Placed on the Dashboard rather than
 * getting its own nav item: it needs to be easy to find (this is the page
 * everyone lands on) without competing with the actual shared work lists,
 * so it starts collapsed, same as "Recente overdrachten" right below it,
 * and only grows a colored badge once something is actually open.
 */
export function MyTasks({
  initialOpen,
  initialCompleted,
  userId,
}: {
  initialOpen: TodoData[];
  initialCompleted: TodoData[];
  userId: string;
}) {
  const [open, setOpen] = React.useState(() => [...initialOpen].sort(sortByTime));
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [expanded, setExpanded] = React.useState(false);
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
    setCompleted((prev) => [todo, ...prev].slice(0, 5));
  }

  function handleDelete(id: string) {
    setOpen((prev) => prev.filter((t) => t.id !== id));
    setCompleted((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-brand-gradient-soft p-5 text-left ring-1 ring-inset ring-sky-400/20 transition-colors hover:bg-sky-500/10"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <ListTodo className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-slate-100">Mijn taken</span>
            <span className="text-xs text-slate-500">
              {open.length === 0 ? "Niets openstaand" : `${open.length} openstaand`}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <CardContent className="flex flex-col gap-4 pt-0">
          {!formOpen ? (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)} className="self-start">
              <Plus className="h-4 w-4" /> Nieuwe taak
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nieuwe persoonlijke taak</CardTitle>
              </CardHeader>
              <CardContent>
                <TodoForm
                  showRoom
                  fixedAssignedToId={userId}
                  onSaved={handleCreated}
                  onCancel={() => setFormOpen(false)}
                />
              </CardContent>
            </Card>
          )}

          {open.length === 0 ? (
            <p className="text-slate-500">Geen openstaande persoonlijke taken.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {open.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  canManage
                  onComplete={handleComplete}
                  onUpdate={handleUpdated}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-400">Recent afgerond</h3>
              <div className="flex flex-col gap-3">
                {completed.map((t) => (
                  <TodoItem key={t.id} todo={t} canManage onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
