"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, DAYS_OF_WEEK_SHORT, TODO_INTERVAL_OPTIONS } from "@/lib/utils";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";
import { serializeTodo, type TodoData } from "./todo-types";

/** DD-MM-JJJJ → ISO yyyy-mm-dd, for the few date props (intervalAnchorDate/showUntil) that
 * TodoData carries as ISO strings (serializeTodo() always produces ISO) but which this form
 * edits as plain DD-MM-JJJJ text, matching every other date field in this codebase. */
function isoToDDMMYYYY(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

export function TodoForm({
  todoId,
  initial,
  onSaved,
  onCancel,
  showRoom = false,
  rooms = [],
  fixedAssignedToId,
}: {
  /** Present when editing an existing task — PATCHes instead of creating. */
  todoId?: string;
  initial?: TodoData;
  onSaved: (todo: TodoData) => void;
  onCancel?: () => void;
  /** Shows a "Kamer" dropdown — only meaningful for personal to-do's. */
  showRoom?: boolean;
  /** Room options for the dropdown — the app's known client rooms. "Algemeen" is always added separately. */
  rooms?: string[];
  /**
   * Makes a NEW task personal to this user id (self, or the medewerker an
   * admin/coordinator is managing in Backend) — a plain data field, not a
   * picker, since who a task is FOR is decided by which screen/widget this
   * form is rendered in, not by typing an id into the form itself. Ignored
   * when editing (todoId set): the existing assignment is preserved as-is.
   */
  fixedAssignedToId?: string;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [priority, setPriority] = React.useState<"NONE" | "LOW" | "MEDIUM" | "HIGH">(
    initial?.priority ?? "MEDIUM"
  );
  const [days, setDays] = React.useState<number[]>(initial?.daysOfWeek ?? []);
  const [time, setTime] = React.useState(initial?.time ?? "");
  const [recurring, setRecurring] = React.useState(initial?.recurring ?? false);
  const [room, setRoom] = React.useState(initial?.room ?? "");
  const [loading, setLoading] = React.useState(false);

  // "days" (daysOfWeek, the pre-existing weekday picker) and "interval" (every
  // 2nd/3rd/.../6th day from a chosen start day) are mutually exclusive — see
  // Todo.intervalDays's schema.prisma comment. Which one is active is its own
  // bit of state rather than inferred from the fields themselves, so toggling
  // the choice can clear the other side's fields without guesswork.
  const [recurrenceType, setRecurrenceType] = React.useState<"days" | "interval">(
    initial?.intervalDays ? "interval" : "days"
  );
  const [intervalDays, setIntervalDays] = React.useState<number>(initial?.intervalDays ?? 2);
  const [intervalAnchorDate, setIntervalAnchorDate] = React.useState(
    isoToDDMMYYYY(initial?.intervalAnchorDate ?? null)
  );
  const [showUntil, setShowUntil] = React.useState(isoToDDMMYYYY(initial?.showUntil ?? null));

  const needsPattern =
    recurring &&
    (recurrenceType === "days" ? days.length === 0 : intervalAnchorDate.length !== 10);
  const allDaysSelected = days.length === 7;

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function toggleEveryDay() {
    setDays(allDaysSelected ? [] : [0, 1, 2, 3, 4, 5, 6]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsPattern) {
      toast.error(
        recurrenceType === "days"
          ? "Kies minstens één dag voor een terugkerende taak"
          : "Kies een startdag voor de terugkerende taak"
      );
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
          daysOfWeek: recurrenceType === "days" ? days : [],
          intervalDays: recurrenceType === "interval" ? intervalDays : undefined,
          intervalAnchorDate: recurrenceType === "interval" ? intervalAnchorDate : undefined,
          showUntil: showUntil || undefined,
          time: time || undefined,
          recurring,
          room: showRoom ? room : undefined,
          // Editing keeps the task's existing assignee; only a brand-new
          // task picks up fixedAssignedToId.
          assignedToId: todoId ? undefined : fixedAssignedToId,
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
        setRoom("");
        setRecurrenceType("days");
        setIntervalDays(2);
        setIntervalAnchorDate("");
        setShowUntil("");
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
      {showRoom && (
        <div>
          <Label htmlFor="room">Kamer</Label>
          <Select id="room" value={room} onChange={(e) => setRoom(e.target.value)} className="sm:w-48">
            <option value="">Algemeen</option>
            {/* Room the task was already tagged with may no longer be an active
                client's room (renamed/removed) — keep it selectable so editing
                doesn't silently reassign the task to Algemeen. */}
            {(room && !rooms.includes(room) ? [...rooms, room] : rooms).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      )}
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
          <div className="mb-1.5 flex items-center gap-3">
            <Label className="mb-0">Patroon (optioneel)</Label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRecurrenceType("days")}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                  recurrenceType === "days"
                    ? "bg-rose-500/15 text-rose-300"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                Dag(en)
              </button>
              <button
                type="button"
                onClick={() => setRecurrenceType("interval")}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                  recurrenceType === "interval"
                    ? "bg-rose-500/15 text-rose-300"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                Interval
              </button>
            </div>
          </div>
          {recurrenceType === "days" ? (
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK_SHORT.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "flex h-10 w-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                    days.includes(i)
                      ? "border-rose-400 bg-rose-500/15 text-rose-300"
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
                    ? "border-rose-400 bg-rose-500/15 text-rose-300"
                    : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
                )}
              >
                Elke dag
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Select
                  value={String(intervalDays)}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className="w-40"
                >
                  {TODO_INTERVAL_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 2 ? "Elke 2 dagen" : `Elke ${n} dagen`}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Input
                  placeholder="Startdag DD-MM-JJJJ"
                  value={intervalAnchorDate}
                  onChange={(e) => setIntervalAnchorDate(formatBirthDateInput(e.target.value))}
                  className="w-40"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-surface2 accent-rose-500"
        />
        Terugkerende taak — bij afronden verschijnt hij automatisch weer open{" "}
        {recurrenceType === "days" ? "op de volgende gekozen dag" : "op de volgende intervaldag"}
      </label>
      <div>
        <Label htmlFor="showUntil">Tonen tot en met (optioneel)</Label>
        <Input
          id="showUntil"
          placeholder="DD-MM-JJJJ"
          value={showUntil}
          onChange={(e) => setShowUntil(formatBirthDateInput(e.target.value))}
          className="w-40"
        />
        <p className="mt-1 text-xs text-slate-500">
          Na deze datum verschijnt de taak niet meer op de Werklijst, ook niet als terugkerende taak.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          loading={loading}
          disabled={!title || needsPattern}
          className="self-start"
        >
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
