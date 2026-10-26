"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { cn, DAYS_OF_WEEK_SHORT, TODO_INTERVAL_OPTIONS } from "@/lib/utils";
import {
  addDaysISO,
  amsterdamNow,
  TODO_CATEGORIES,
  TODO_CATEGORY_META,
  TODO_CHECKLIST_MAX,
  TODO_CHECKLIST_TEXT_MAX,
  TODO_DESCRIPTION_MAX,
  TODO_PRIORITY_LABEL,
  TODO_TITLE_MAX,
  weekdayOfISO,
  type TodoCategoryKey,
  type TodoData,
  type TodoPriorityKey,
} from "@/lib/todos-shared";
import { api, apiMessage, CATEGORY_ICON } from "./todo-ui";
import { useTodoEnv } from "./todo-env";

type When = "none" | "date" | "pattern";
type Step = { key: string; id?: string; text: string };

export type TodoPrefill = Partial<{
  title: string;
  description: string;
  priority: TodoPriorityKey;
  time: string;
  dueDate: string;
  category: TodoCategoryKey | null;
  clientId: string | null;
  steps: string[];
}>;

/** ISO instant ("2026-01-15T00:00:00.000Z") -> the "yyyy-mm-dd" a native date input expects — safe here since these fields are always stored as UTC-midnight calendar dates (see Todo.intervalAnchorDate's schema.prisma comment). */
function toDateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

let stepCounter = 0;
const newKey = () => `s${++stepCounter}`;

const chipClass = (active: boolean) =>
  cn(
    "flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
    active ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
  );

export function TodoForm({
  todoId,
  initial,
  prefill,
  onSaved,
  onCancel,
  showRoom = false,
  rooms = [],
  fixedAssignedToId,
}: {
  /** Present when editing an existing task — PATCHes instead of creating. */
  todoId?: string;
  initial?: TodoData;
  /** Starting values for a NEW task (from the quick-add bar). */
  prefill?: TodoPrefill;
  onSaved: (todo: TodoData) => void;
  onCancel?: () => void;
  /** Shows a "Kamer" dropdown — only meaningful for personal to-do's. */
  showRoom?: boolean;
  /** Room options for the dropdown — the app's known client rooms. "Algemeen" is always added separately. */
  rooms?: string[];
  /**
   * Makes a NEW task personal to this user id (self, or the medewerker an
   * admin/coordinator is managing via Taken toewijzen) — a plain data field,
   * not a picker, since who a task is FOR is decided by which screen/widget
   * this form is rendered in. Ignored when editing: the assignment is preserved.
   */
  fixedAssignedToId?: string;
}) {
  const { clients, nowMs } = useTodoEnv();
  const today = amsterdamNow(nowMs || Date.now()).dateISO;

  const [title, setTitle] = React.useState(initial?.title ?? prefill?.title ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? prefill?.description ?? "");
  const [priority, setPriority] = React.useState<TodoPriorityKey>(initial?.priority ?? prefill?.priority ?? "MEDIUM");
  const [category, setCategory] = React.useState<TodoCategoryKey | null>(initial ? initial.category : (prefill?.category ?? null));
  const [clientId, setClientId] = React.useState<string>(initial?.clientId ?? prefill?.clientId ?? "");
  const [when, setWhen] = React.useState<When>(
    initial ? (initial.dueDate ? "date" : initial.daysOfWeek.length > 0 || initial.intervalDays || initial.recurring ? "pattern" : "none") : prefill?.dueDate ? "date" : "none"
  );
  const [dueDate, setDueDate] = React.useState(toDateOnly(initial?.dueDate) || prefill?.dueDate || "");
  const [time, setTime] = React.useState(initial?.time ?? prefill?.time ?? "");
  const [days, setDays] = React.useState<number[]>(initial?.daysOfWeek ?? []);
  const [recurrenceType, setRecurrenceType] = React.useState<"days" | "interval">(initial?.intervalDays ? "interval" : "days");
  const [intervalDays, setIntervalDays] = React.useState<number>(initial?.intervalDays ?? 2);
  const [intervalAnchorDate, setIntervalAnchorDate] = React.useState(toDateOnly(initial?.intervalAnchorDate));
  const [showUntil, setShowUntil] = React.useState(toDateOnly(initial?.showUntil));
  const [recurring, setRecurring] = React.useState(initial?.recurring ?? false);
  const [room, setRoom] = React.useState(initial?.room ?? "");
  const [steps, setSteps] = React.useState<Step[]>(
    initial ? initial.checklist.map((c) => ({ key: newKey(), id: c.id, text: c.text })) : (prefill?.steps ?? []).map((text) => ({ key: newKey(), text }))
  );
  const [version, setVersion] = React.useState<string | undefined>(initial?.version);
  const [conflict, setConflict] = React.useState<TodoData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const stepRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const focusAfterRender = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (focusAfterRender.current) {
      stepRefs.current[focusAfterRender.current]?.focus();
      focusAfterRender.current = null;
    }
  }, [steps]);

  const patternMissing = when === "pattern" && recurring && (recurrenceType === "days" ? days.length === 0 : !intervalAnchorDate);
  const dateMissing = when === "date" && !dueDate;
  const canSave = title.trim().length > 0 && !patternMissing && !dateMissing && !loading;
  const allDaysSelected = days.length === 7;

  function applyTodo(t: TodoData) {
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPriority(t.priority);
    setCategory(t.category);
    setClientId(t.clientId ?? "");
    setWhen(t.dueDate ? "date" : t.daysOfWeek.length > 0 || t.intervalDays || t.recurring ? "pattern" : "none");
    setDueDate(toDateOnly(t.dueDate));
    setTime(t.time ?? "");
    setDays(t.daysOfWeek);
    setRecurrenceType(t.intervalDays ? "interval" : "days");
    setIntervalDays(t.intervalDays ?? 2);
    setIntervalAnchorDate(toDateOnly(t.intervalAnchorDate));
    setShowUntil(toDateOnly(t.showUntil));
    setRecurring(t.recurring);
    setRoom(t.room ?? "");
    setSteps(t.checklist.map((c) => ({ key: newKey(), id: c.id, text: c.text })));
    setVersion(t.version);
    setConflict(null);
  }

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function setStepText(key: string, text: string) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, text } : s)));
  }

  function addStep(afterKey?: string) {
    if (steps.length >= TODO_CHECKLIST_MAX) return;
    const step = { key: newKey(), text: "" };
    setSteps((prev) => {
      const at = afterKey ? prev.findIndex((s) => s.key === afterKey) + 1 : prev.length;
      return [...prev.slice(0, at), step, ...prev.slice(at)];
    });
    focusAfterRender.current = step.key;
  }

  function moveStep(key: string, delta: number) {
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function submit(force = false) {
    if (!canSave) return;
    setLoading(true);
    const cleanSteps = steps.map((s) => ({ id: s.id, text: s.text.trim() })).filter((s) => s.text);
    const res = await api(todoId ? `/api/todos/${todoId}` : "/api/todos", todoId ? "PATCH" : "POST", {
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      clientId: clientId || null,
      time: time || undefined,
      dueDate: when === "date" ? dueDate : "",
      daysOfWeek: when === "pattern" && recurrenceType === "days" ? days : [],
      intervalDays: when === "pattern" && recurrenceType === "interval" ? intervalDays : undefined,
      intervalAnchorDate: when === "pattern" && recurrenceType === "interval" ? intervalAnchorDate : undefined,
      showUntil: when === "pattern" && recurring && showUntil ? showUntil : undefined,
      recurring: when === "pattern" && recurring,
      room: showRoom ? room : undefined,
      checklist: cleanSteps,
      // Editing keeps the task's existing assignee; only a brand-new task picks up fixedAssignedToId.
      assignedToId: todoId ? undefined : fixedAssignedToId,
      since: todoId ? version : undefined,
      force: force || undefined,
    });
    setLoading(false);
    if (res.status === 409 && res.data.current) {
      setConflict(res.data.current);
      return;
    }
    if (!res.ok || !res.data.todo) {
      toast.error(apiMessage(res, "Opslaan mislukt"));
      return;
    }
    toast.success(todoId ? "Taak bijgewerkt" : "Taak toegevoegd");
    onSaved(res.data.todo);
  }

  const quickDates = [
    { label: "Vandaag", value: today },
    { label: "Morgen", value: addDaysISO(today, 1) },
    { label: "Volgende week", value: addDaysISO(today, 7 - weekdayOfISO(today)) },
  ];
  const roomOptions = room && !rooms.includes(room) ? [...rooms, room] : rooms;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
      className="flex flex-col gap-5"
    >
      <div>
        <Label htmlFor="todo-title">Taak</Label>
        <Input id="todo-title" value={title} maxLength={TODO_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} autoFocus required placeholder="Wat moet er gebeuren?" />
        <p className="mt-1 text-xs text-slate-500">Houd de titel kort. Details horen in de omschrijving.</p>
      </div>

      <div>
        <Label>Prioriteit</Label>
        <Segmented
          ariaLabel="Prioriteit"
          value={priority}
          onChange={setPriority}
          options={(["NONE", "LOW", "MEDIUM", "HIGH"] as const).map((p) => ({ value: p, label: TODO_PRIORITY_LABEL[p] }))}
        />
      </div>

      <div>
        <Label>Categorie (optioneel)</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorie">
          {TODO_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const active = category === c;
            return (
              <button key={c} type="button" aria-pressed={active} title={TODO_CATEGORY_META[c].hint} onClick={() => setCategory(active ? null : c)} className={chipClass(active)}>
                <Icon className="h-4 w-4" /> {TODO_CATEGORY_META[c].label}
              </button>
            );
          })}
        </div>
      </div>

      {clients.length > 0 && (
        <div>
          <Label htmlFor="todo-client">Over cliënt (optioneel)</Label>
          <Select id="todo-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="sm:max-w-sm">
            <option value="">Geen cliënt</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.room && c.name !== c.room ? ` (kamer ${c.room})` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface2/30 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label>Wanneer</Label>
            <Segmented
              ariaLabel="Wanneer"
              value={when}
              onChange={(v) => {
                setWhen(v);
                if (v === "date" && !dueDate) setDueDate(today);
              }}
              options={[
                { value: "none", label: "Geen vaste dag" },
                { value: "date", label: "Op datum" },
                { value: "pattern", label: "Vaste dagen" },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="todo-time">Tijd (optioneel)</Label>
            <Input id="todo-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-36" />
          </div>
        </div>

        {when === "none" && <p className="text-xs text-slate-500">De taak staat elke dag op de lijst totdat iemand hem afrondt.</p>}

        {when === "date" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="todo-due">Uiterste datum</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="todo-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
              {quickDates.map((q) => (
                <button key={q.label} type="button" onClick={() => setDueDate(q.value)} className={chipClass(dueDate === q.value)}>
                  {q.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Na deze datum staat de taak als &quot;te laat&quot; bovenaan tot hij is afgerond.</p>
          </div>
        )}

        {when === "pattern" && (
          <div className="flex flex-col gap-3">
            <Segmented
              ariaLabel="Soort herhaling"
              size="sm"
              value={recurrenceType}
              onChange={setRecurrenceType}
              options={[
                { value: "days", label: "Dagen van de week" },
                { value: "interval", label: "Elke zoveel dagen" },
              ]}
            />
            {recurrenceType === "days" ? (
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK_SHORT.map((label, i) => (
                  <button key={label} type="button" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)} className={cn(chipClass(days.includes(i)), "w-11 px-0")}>
                    {label}
                  </button>
                ))}
                <button type="button" aria-pressed={allDaysSelected} onClick={() => setDays(allDaysSelected ? [] : [0, 1, 2, 3, 4, 5, 6])} className={chipClass(allDaysSelected)}>
                  Elke dag
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="todo-interval">Elke...</Label>
                  <Select id="todo-interval" value={String(intervalDays)} onChange={(e) => setIntervalDays(Number(e.target.value))} className="w-40">
                    {TODO_INTERVAL_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n === 2 ? "andere dag" : `${n}e dag`}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="todo-anchor">Startdag</Label>
                  <Input id="todo-anchor" type="date" value={intervalAnchorDate} onChange={(e) => setIntervalAnchorDate(e.target.value)} className="w-44" />
                </div>
              </div>
            )}
            <Checkbox checked={recurring} onChange={setRecurring} className="text-sm text-slate-200">
              Terugkerende taak: na afronden verschijnt hij automatisch weer open {recurrenceType === "days" ? "op de volgende gekozen dag" : "op de volgende dag van het interval"}
            </Checkbox>
            {recurring && (
              <div>
                <Label htmlFor="todo-until">Eindigt op (optioneel)</Label>
                <Input id="todo-until" type="date" value={showUntil} onChange={(e) => setShowUntil(e.target.value)} className="w-44" />
                <p className="mt-1 text-xs text-slate-500">Vanaf deze datum verdwijnt de taak van de Werklijst, ook als hij nog open staat.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showRoom && (
        <div>
          <Label htmlFor="todo-room">Kamer</Label>
          <Select id="todo-room" value={room} onChange={(e) => setRoom(e.target.value)} className="sm:w-48">
            <option value="">Algemeen</option>
            {/* A room the task was tagged with may no longer be an active client's room — keep it selectable so editing doesn't silently reassign the task to Algemeen. */}
            {roomOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="todo-description">Omschrijving (optioneel)</Label>
        <Textarea id="todo-description" value={description} maxLength={TODO_DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} className="min-h-[88px]" />
      </div>

      <div>
        <Label className="mb-1.5">Stappen (optioneel)</Label>
        {steps.length > 0 && (
          <ul className="mb-2 flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-center text-xs tabular-nums text-slate-500">{i + 1}</span>
                <Input
                  ref={(el) => {
                    stepRefs.current[s.key] = el;
                  }}
                  value={s.text}
                  maxLength={TODO_CHECKLIST_TEXT_MAX}
                  aria-label={`Stap ${i + 1}`}
                  onChange={(e) => setStepText(s.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      if (s.text.trim()) addStep(s.key);
                    } else if (e.key === "Backspace" && !s.text) {
                      e.preventDefault();
                      setSteps((prev) => prev.filter((x) => x.key !== s.key));
                    }
                  }}
                />
                <button type="button" aria-label={`Stap ${i + 1} omhoog`} disabled={i === 0} onClick={() => moveStep(s.key, -1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-surface2 hover:text-slate-100 disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" aria-label={`Stap ${i + 1} omlaag`} disabled={i === steps.length - 1} onClick={() => moveStep(s.key, 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-surface2 hover:text-slate-100 disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" aria-label={`Stap ${i + 1} verwijderen`} onClick={() => setSteps((prev) => prev.filter((x) => x.key !== s.key))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-300">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={steps.length >= TODO_CHECKLIST_MAX} onClick={() => addStep()}>
          <Plus className="h-4 w-4" /> Stap toevoegen
        </Button>
      </div>

      {conflict && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p>
            <strong>Een collega heeft deze taak zojuist gewijzigd.</strong> Jouw wijzigingen zijn nog niet opgeslagen.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => applyTodo(conflict)}>
              Nieuwste versie laden
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={() => void submit(true)}>
              Toch mijn versie opslaan
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" loading={loading} disabled={!canSave}>
          {todoId ? "Opslaan" : "Toevoegen"}
        </Button>
        {onCancel && (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
            Annuleren
          </Button>
        )}
        <span className="hidden text-xs text-slate-500 sm:inline">⌘/Ctrl + Enter om op te slaan</span>
      </div>
    </form>
  );
}
