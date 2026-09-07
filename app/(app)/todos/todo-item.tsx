"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Repeat, Clock, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, DAYS_OF_WEEK_SHORT, PRIORITY_LABELS } from "@/lib/utils";
import { serializeTodo, type TodoData } from "./todo-types";
import { TodoForm } from "./todo-form";

const PRIORITY_VARIANT = { LOW: "slate", MEDIUM: "sky", HIGH: "red" } as const;

function DaysBadge({ days }: { days: number[] }) {
  if (days.length === 0) return null;
  if (days.length === 7) {
    return (
      <Badge variant="slate" className="gap-1">
        <Repeat className="h-3 w-3" /> Elke dag
      </Badge>
    );
  }
  return <Badge variant="slate">{days.map((d) => DAYS_OF_WEEK_SHORT[d]).join(" ")}</Badge>;
}

export function TodoItem({
  todo,
  canManage = false,
  onComplete,
  onUpdate,
  onDelete,
}: {
  todo: TodoData;
  /** Admin-only: shows edit/delete controls. */
  canManage?: boolean;
  onComplete?: (todo: TodoData) => void;
  onUpdate?: (todo: TodoData) => void;
  onDelete?: (id: string) => void;
}) {
  const [showComment, setShowComment] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleComplete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/todos/${todo.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast.success("Taak afgerond");
      onComplete?.(serializeTodo(data.todo));
    } catch {
      toast.error("Afronden mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`"${todo.title}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Taak verwijderd");
      onDelete?.(todo.id);
    } catch {
      toast.error("Verwijderen mislukt");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-5">
          <TodoForm
            todoId={todo.id}
            initial={todo}
            onSaved={(updated) => {
              setEditing(false);
              onUpdate?.(updated);
            }}
            onCancel={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {todo.time && (
              <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-200">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {todo.time}
              </span>
            )}
            <span className={todo.completed ? "text-slate-500 line-through" : "font-medium text-slate-100"}>
              {todo.title}
            </span>
            <Badge variant={PRIORITY_VARIANT[todo.priority]}>{PRIORITY_LABELS[todo.priority]}</Badge>
            <DaysBadge days={todo.daysOfWeek} />
            {todo.recurring && todo.daysOfWeek.length !== 7 && (
              <Badge variant="emerald" className="gap-1">
                <Repeat className="h-3 w-3" /> Terugkerend
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {!todo.completed && !showComment && (
              <>
                <Button size="sm" variant="secondary" loading={loading} onClick={handleComplete}>
                  {!loading && <CheckCircle2 className="h-4 w-4" />} Afronden
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowComment(true)}>
                  + commentaar
                </Button>
              </>
            )}
            {canManage && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Bewerken">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deleting}
                  onClick={handleDelete}
                  aria-label="Verwijderen"
                  className="text-red-400 hover:text-red-300"
                >
                  {!deleting && <Trash2 className="h-4 w-4" />}
                </Button>
              </>
            )}
          </div>
        </div>
        {todo.description && <p className="text-sm text-slate-400">{todo.description}</p>}
        {!todo.completed && showComment && (
          <div className="flex flex-col gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Commentaar bij afronden..."
              className="min-h-[70px]"
            />
            <Button size="sm" variant="secondary" loading={loading} onClick={handleComplete} className="self-start">
              Afronden met commentaar
            </Button>
          </div>
        )}
        <div className="text-xs text-slate-500">
          Aangemaakt door {todo.createdByName} &middot; {formatDateTime(new Date(todo.createdAt))}
        </div>
        {todo.completed && (
          <div className="text-xs text-emerald-400">
            Afgerond door {todo.completedByName} &middot;{" "}
            {todo.completedAt && formatDateTime(new Date(todo.completedAt))}
            {todo.completionNote ? ` — ${todo.completionNote}` : ""}
            {todo.recurring ? " · verschijnt automatisch weer open op de volgende geplande dag" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
