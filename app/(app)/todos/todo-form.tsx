"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, DAYS_OF_WEEK_SHORT } from "@/lib/utils";
import { serializeTodo, type TodoData } from "./todo-types";

export function TodoForm({
  todoId,
  initial,
  onSaved,
  onCancel,
}: {
  /** Present when editing an existing task — PATCHes instead of creating. */
  todoId?: string;
  initial?: TodoData;
  onSaved: (todo: TodoData) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [priority, setPriority] = React.useState<"NONE" | "LOW" | "MEDIUM" | "HIGH">(
    initial?.priority ?? "MEDIUM"
  );
  const [days, setDays] = React.useState<number[]>(initial?.daysOfWeek ?? []);
  const [time, setTime] = React.useState(initial?.time ?? "");
  const [recurring, setRecurring] = React.useState(initial?.recurring ?? false);
  const [loading, setLoading] = React.useState(false);

  const needsDay = recurring && days.length === 0;
  const allDaysSelected = days.length === 7;

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function toggleEveryDay() {
    setDays(allDaysSelected ? [] : [0, 1, 2, 3, 4, 5, 6]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsDay) {
      toast.error("Kies minstens één dag voor een terugkerende taak");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(todoId ? `/api/todos/${todoId}` : "/api/todos", {
        method: todoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          daysOfWeek: days,
          time: time || undefined,
          recurring,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success(todoId ? "Taak bijgewerkt" : "Taak toegevoegd");
      onSaved(serializeTodo(data.todo));
      if (!todoId) {
        setTitle("");
        setDescription("");
        setPriority("MEDIUM");
        setDays([]);
        setTime("");
        setRecurring(false);
      }
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="title">Taak</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </div>
        <div>
          <Label htmlFor="priority">Prioriteit</Label>
          <Select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "NONE" | "LOW" | "MEDIUM" | "HIGH")}
          >
            <option value="NONE">Geen</option>
            <option value="LOW">Laag</option>
            <option value="MEDIUM">Gemiddeld</option>
            <option value="HIGH">Hoog</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="description">Omschrijving (optioneel)</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <Label htmlFor="time">Tijd (optioneel)</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label>Dag(en) (optioneel)</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK_SHORT.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                className={cn(
                  "flex h-10 w-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                  days.includes(i)
                    ? "border-sky-400 bg-sky-500/15 text-sky-300"
                    : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleEveryDay}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                allDaysSelected
                  ? "border-sky-400 bg-sky-500/15 text-sky-300"
                  : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
              )}
            >
              Elke dag
            </button>
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-surface2 accent-sky-500"
        />
        Terugkerende taak — bij afronden verschijnt hij automatisch weer open op de volgende
        gekozen dag
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={loading} disabled={!title || needsDay} className="self-start">
          {todoId ? "Opslaan" : "Toevoegen"}
        </Button>
        {onCancel && (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel} className="self-start">
            Annuleren
          </Button>
        )}
      </div>
    </form>
  );
}
