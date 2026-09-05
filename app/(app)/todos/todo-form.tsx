"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DAYS_OF_WEEK } from "@/lib/utils";
import { serializeTodo, type TodoData } from "./todo-types";

export function TodoForm({
  onCreated,
  onCancel,
}: {
  onCreated: (todo: TodoData) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [dayOfWeek, setDayOfWeek] = React.useState<string>("");
  const [recurring, setRecurring] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const needsDay = recurring && dayOfWeek === "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsDay) {
      toast.error("Kies een dag voor een terugkerende taak");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          dayOfWeek: dayOfWeek === "" ? undefined : Number(dayOfWeek),
          recurring,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Taak toegevoegd");
      onCreated(serializeTodo(data.todo));
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDayOfWeek("");
      setRecurring(false);
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
            onChange={(e) => setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
          >
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="dayOfWeek">Dag (optioneel)</Label>
          <Select id="dayOfWeek" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            <option value="">Geen specifieke dag</option>
            {DAYS_OF_WEEK.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end pb-2.5 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-surface2"
            />
            Terugkerende taak (wekelijks) — bij afronden verschijnt hij automatisch weer voor
            volgende week
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={loading} disabled={!title || needsDay} className="self-start">
          Toevoegen
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
