"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, DAYS_OF_WEEK, PRIORITY_LABELS } from "@/lib/utils";
import { serializeTodo, type TodoData } from "./todo-types";

const PRIORITY_VARIANT = { LOW: "slate", MEDIUM: "sky", HIGH: "red" } as const;

export function TodoItem({
  todo,
  onComplete,
}: {
  todo: TodoData;
  onComplete?: (todo: TodoData) => void;
}) {
  const [showComment, setShowComment] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);

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

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={todo.completed ? "text-slate-500 line-through" : "font-medium text-slate-100"}>
              {todo.title}
            </span>
            <Badge variant={PRIORITY_VARIANT[todo.priority]}>{PRIORITY_LABELS[todo.priority]}</Badge>
            {todo.dayOfWeek !== null && <Badge variant="slate">{DAYS_OF_WEEK[todo.dayOfWeek]}</Badge>}
            {todo.recurring && (
              <Badge variant="emerald" className="gap-1">
                <Repeat className="h-3 w-3" /> Wekelijks
              </Badge>
            )}
          </div>
          {!todo.completed && !showComment && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" loading={loading} onClick={handleComplete}>
                {!loading && <CheckCircle2 className="h-4 w-4" />} Afronden
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowComment(true)}>
                + commentaar
              </Button>
            </div>
          )}
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
            {todo.recurring ? " · verschijnt automatisch weer volgende week" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
