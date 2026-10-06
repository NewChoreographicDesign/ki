"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Circle,
  ChevronDown,
  Clock,
  Archive,
  Eye,
  ShieldAlert,
  HeartHandshake,
  Users,
  Wind,
  CalendarClock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, DAYS_OF_WEEK_SHORT, TODO_INTERVAL_OPTIONS, formatDDMMYYYY, formatDateTime, todayCalendarDate } from "@/lib/utils";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";

export type PlanTaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  time: string | null;
  recurring: boolean;
  daysOfWeek: number[];
  intervalDays: number | null;
  intervalAnchorDate: string | null;
  showUntil: string | null;
  completed: boolean;
  completedAt: string | null;
  completedByName: string | null;
  completionNote: string | null;
  createdAt: string;
};

export type PlanEvaluationRow = {
  id: string;
  date: string;
  pillarsThatHelped: string;
  reflection: string;
  decision: "CONTINUE" | "ADJUSTED";
  userName: string;
};

export type InterventionPlanRow = {
  id: string;
  clientId: string;
  version: number;
  status: "ACTIEF" | "GEARCHIVEERD";
  goal: string;
  stepsAanwezigheid: string;
  stepsVerzet: string;
  stepsHerstelRelatie: string;
  stepsSteunSupport: string;
  stepsDeescalatie: string;
  startDate: string;
  evaluationDate: string;
  createdByName: string;
  createdAt: string;
  archivedAt: string | null;
  archivedByName: string | null;
  tasks: PlanTaskRow[];
  evaluations: PlanEvaluationRow[];
};

const PILLARS = [
  { field: "stepsAanwezigheid", value: "AANWEZIGHEID", label: "Aanwezigheid", icon: Eye },
  { field: "stepsVerzet", value: "VERZET", label: "Verzet", icon: ShieldAlert },
  { field: "stepsHerstelRelatie", value: "HERSTEL_RELATIE", label: "Herstel van de relatie", icon: HeartHandshake },
  { field: "stepsSteunSupport", value: "STEUN_SUPPORT", label: "Steun en support", icon: Users },
  { field: "stepsDeescalatie", value: "DEESCALATIE", label: "De-escalatie", icon: Wind },
] as const satisfies { field: keyof InterventionPlanRow; value: string; label: string; icon: unknown }[];

const PILLAR_LABEL: Record<string, string> = Object.fromEntries(PILLARS.map((p) => [p.value, p.label]));

function todayDDMMYYYY(): string {
  return formatDDMMYYYY(todayCalendarDate());
}

async function api<T>(url: string, json: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Er is iets misgegaan");
  return data as T;
}

/**
 * The Verbindend Gezag plan for one client — its own tab in Overdracht
 * (see overdracht-manager.tsx), separate from Interventies: a plan is a
 * planned, team-wide trajectory for a client, not the record of a sudden
 * incident. Shows the active plan (or a start button if there is none
 * yet), its linked task's live history, the evaluate flow, and a
 * collapsible archive of every earlier version.
 */
export function InterventionPlanSection({
  clientId,
  plans,
  onChanged,
}: {
  clientId: string;
  plans: InterventionPlanRow[];
  onChanged: () => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const [showArchive, setShowArchive] = React.useState(false);

  const activePlan = plans.find((p) => p.status === "ACTIEF") ?? null;
  const archivedPlans = plans.filter((p) => p.status !== "ACTIEF");

  return (
    <div className="flex flex-col gap-3">
      {activePlan ? (
        <ActivePlanCard plan={activePlan} onChanged={onChanged} />
      ) : creating ? (
        <PlanForm
          clientId={clientId}
          onSaved={() => {
            setCreating(false);
            onChanged();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Interventieplan starten
        </Button>
      )}

      {archivedPlans.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
          >
            <Archive className="h-3.5 w-3.5" />
            Eerdere versies ({archivedPlans.length})
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showArchive ? "rotate-180" : ""}`} />
          </button>
          {showArchive && (
            <div className="mt-3 flex flex-col gap-3">
              {archivedPlans.map((p) => (
                <ArchivedPlanCard key={p.id} plan={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PillarGrid({ plan }: { plan: Pick<InterventionPlanRow, (typeof PILLARS)[number]["field"]> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PILLARS.map(({ field, label, icon: Icon }) => (
        <div key={field} className="rounded-xl border border-border bg-surface2/50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Icon className="h-3.5 w-3.5" /> {label}
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-200">{plan[field]}</p>
        </div>
      ))}
    </div>
  );
}

function ActivePlanCard({
  plan,
  onChanged,
}: {
  plan: InterventionPlanRow;
  onChanged: () => void;
}) {
  const [evaluating, setEvaluating] = React.useState(false);
  const overdue = new Date(plan.evaluationDate).getTime() < Date.now();

  return (
    <Card className="border-rose-500/20">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="forest">Actief — versie {plan.version}</Badge>
            <Badge variant={overdue ? "red" : "slate"}>
              <CalendarClock className="mr-1 h-3 w-3" />
              Evaluatie op {formatDDMMYYYY(new Date(plan.evaluationDate))}
              {overdue ? " · verlopen" : ""}
            </Badge>
          </div>
          <span className="text-xs text-slate-500">
            Gestart door {plan.createdByName} op {formatDDMMYYYY(new Date(plan.startDate))}
          </span>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Concreet doel</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{plan.goal}</p>
        </div>

        <PillarGrid plan={plan} />

        {plan.tasks.length > 0 && <TaskHistoryPanel tasks={plan.tasks} onChanged={onChanged} />}

        {evaluating ? (
          <EvaluateForm plan={plan} onSaved={() => { setEvaluating(false); onChanged(); }} onCancel={() => setEvaluating(false)} />
        ) : (
          <Button size="sm" variant={overdue ? "secondary" : "outline"} className="self-start" onClick={() => setEvaluating(true)}>
            Plan evalueren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ArchivedPlanCard({ plan }: { plan: InterventionPlanRow }) {
  const [open, setOpen] = React.useState(false);
  const evaluation = plan.evaluations[plan.evaluations.length - 1];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface2"
      >
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
            Versie {plan.version}
            <Badge variant="slate" className="text-[11px]">Gearchiveerd</Badge>
          </span>
          <span className="truncate text-xs text-slate-500">{plan.goal}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <p className="text-xs text-slate-500">
            Gearchiveerd door {plan.archivedByName ?? "onbekend"} op{" "}
            {plan.archivedAt ? formatDateTime(new Date(plan.archivedAt)) : "onbekend"}
          </p>
          <PillarGrid plan={plan} />
          {plan.tasks.length > 0 && <TaskHistoryPanel tasks={plan.tasks} onChanged={() => {}} readOnly />}
          {evaluation && (
            <div className="rounded-xl border border-border bg-surface1 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Evaluatie</p>
              <p className="mt-1 text-xs text-slate-500">
                {evaluation.userName} · {formatDDMMYYYY(new Date(evaluation.date))}
              </p>
              {evaluation.pillarsThatHelped && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {evaluation.pillarsThatHelped.split(",").filter(Boolean).map((v) => (
                    <Badge key={v} variant="forest" className="text-[11px]">
                      {PILLAR_LABEL[v] ?? v}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{evaluation.reflection}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The plan-linked task(s), "visually smart integrated" as asked: the
 * currently open occurrence (if any) rendered as a compact, completable
 * row right here (no need to jump to the Werklijst), with every earlier
 * completed occurrence — and its comment, if one was left — as a small
 * checked-off history list below. Every occurrence shares the same
 * interventionPlanId (see regenerateRecurringTodos), so this is simply
 * every task the server sent for this plan, newest first.
 */
function TaskHistoryPanel({ tasks, onChanged, readOnly = false }: { tasks: PlanTaskRow[]; onChanged: () => void; readOnly?: boolean }) {
  const open = tasks.filter((t) => !t.completed);
  const completed = [...tasks.filter((t) => t.completed)].reverse();
  const [note, setNote] = React.useState<Record<string, string>>({});
  const [completing, setCompleting] = React.useState<string | null>(null);

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    try {
      const res = await fetch(`/api/todos/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionNote: note[taskId] ?? "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Afronden mislukt");
        return;
      }
      toast.success("Taak afgerond");
      onChanged();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setCompleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface2/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gekoppelde taak</p>
      {open.map((t) => (
        <div key={t.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface1 p-3">
          <div className="flex items-start gap-2">
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div className="flex-1">
              <p className="text-sm text-slate-200">{t.title}</p>
              <p className="text-xs text-slate-500">{recurrenceLabel(t)}</p>
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={note[t.id] ?? ""}
                onChange={(e) => setNote((prev) => ({ ...prev, [t.id]: e.target.value }))}
                placeholder="Opmerking (optioneel)"
                className="h-9 flex-1 text-sm"
              />
              <Button size="sm" variant="secondary" loading={completing === t.id} onClick={() => handleComplete(t.id)}>
                <CheckCircle2 className="h-4 w-4" /> Afronden
              </Button>
            </div>
          )}
        </div>
      ))}
      {completed.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {completed.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-400" />
              <div className="flex-1">
                <span className="text-slate-300">{t.title}</span>{" "}
                <span className="text-xs text-slate-500">
                  — {t.completedByName} · {t.completedAt ? formatDateTime(new Date(t.completedAt)) : ""}
                </span>
                {t.completionNote && <p className="text-xs italic text-slate-500">&ldquo;{t.completionNote}&rdquo;</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open.length === 0 && completed.length === 0 && <p className="text-xs text-slate-500">Geen taakgeschiedenis.</p>}
    </div>
  );
}

function recurrenceLabel(t: PlanTaskRow): string {
  if (t.intervalDays) return `Elke ${t.intervalDays === 2 ? "andere dag" : `${t.intervalDays}e dag`}`;
  if (t.daysOfWeek.length > 0) return t.daysOfWeek.map((d) => DAYS_OF_WEEK_SHORT[d]).join(", ");
  if (t.recurring) return "Elke dag";
  return "Eenmalig";
}

// --- Shared plan-content + task sub-forms (create + "aanpassen" share these) ---

type PlanContentValue = {
  goal: string;
  stepsAanwezigheid: string;
  stepsVerzet: string;
  stepsHerstelRelatie: string;
  stepsSteunSupport: string;
  stepsDeescalatie: string;
  evaluationDate: string;
};

function PlanContentFields({ value, onChange }: { value: PlanContentValue; onChange: (patch: Partial<PlanContentValue>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="plan-goal">Concreet doel</Label>
        <Textarea
          id="plan-goal"
          value={value.goal}
          onChange={(e) => onChange({ goal: e.target.value })}
          placeholder="Wat willen we concreet bereiken met deze cliënt?"
          className="min-h-[70px]"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PILLARS.map(({ field, label }) => (
          <div key={field}>
            <Label htmlFor={`plan-${field}`}>{label}</Label>
            <Textarea
              id={`plan-${field}`}
              value={value[field]}
              onChange={(e) => onChange({ [field]: e.target.value } as Partial<PlanContentValue>)}
              placeholder="Welke concrete stappen horen hierbij?"
              className="min-h-[70px]"
              required
            />
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor="plan-evaluationDate">Evaluatiedatum</Label>
        <Input
          id="plan-evaluationDate"
          placeholder="DD-MM-JJJJ"
          value={value.evaluationDate}
          onChange={(e) => onChange({ evaluationDate: formatBirthDateInput(e.target.value) })}
          className="w-40"
          required
        />
      </div>
    </div>
  );
}

type TaskFieldsValue = {
  enabled: boolean;
  title: string;
  description: string;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  time: string;
  recurring: boolean;
  recurrenceType: "days" | "interval";
  days: number[];
  intervalDays: number;
  intervalAnchorDate: string;
};

const EMPTY_TASK_FIELDS: TaskFieldsValue = {
  enabled: false,
  title: "",
  description: "",
  priority: "MEDIUM",
  time: "",
  recurring: true,
  recurrenceType: "days",
  days: [],
  intervalDays: 2,
  intervalAnchorDate: "",
};

function taskFieldsToPayload(v: TaskFieldsValue) {
  if (!v.enabled || !v.title.trim()) return undefined;
  return {
    title: v.title.trim(),
    description: v.description || undefined,
    priority: v.priority,
    time: v.time || undefined,
    recurring: v.recurring,
    daysOfWeek: v.recurring && v.recurrenceType === "days" ? v.days : undefined,
    intervalDays: v.recurring && v.recurrenceType === "interval" ? v.intervalDays : undefined,
    intervalAnchorDate: v.recurring && v.recurrenceType === "interval" ? v.intervalAnchorDate : undefined,
  };
}

function PlanTaskFields({ value, onChange }: { value: TaskFieldsValue; onChange: (patch: Partial<TaskFieldsValue>) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface2/30 p-3">
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="h-4 w-4 rounded border-slate-600 bg-surface2 accent-rose-500"
        />
        Taak koppelen aan dit plan
      </label>
      {value.enabled && (
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="task-title">Taak</Label>
            <Input id="task-title" value={value.title} onChange={(e) => onChange({ title: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="task-priority">Prioriteit</Label>
              <Select id="task-priority" value={value.priority} onChange={(e) => onChange({ priority: e.target.value as TaskFieldsValue["priority"] })}>
                <option value="NONE">Geen</option>
                <option value="LOW">Laag</option>
                <option value="MEDIUM">Gemiddeld</option>
                <option value="HIGH">Hoog</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-time">Tijd (optioneel)</Label>
              <Input id="task-time" type="time" value={value.time} onChange={(e) => onChange({ time: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={value.recurring}
              onChange={(e) => onChange({ recurring: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-surface2 accent-rose-500"
            />
            Terugkerende taak
          </label>
          {value.recurring && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ recurrenceType: "days" })}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                    value.recurrenceType === "days" ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300"
                  )}
                >
                  Dagen
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ recurrenceType: "interval" })}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                    value.recurrenceType === "interval" ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300"
                  )}
                >
                  Interval
                </button>
              </div>
              {value.recurrenceType === "days" ? (
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK_SHORT.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onChange({ days: value.days.includes(i) ? value.days.filter((d) => d !== i) : [...value.days, i].sort() })}
                      className={cn(
                        "flex h-9 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                        value.days.includes(i) ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label htmlFor="task-intervalDays">Elke...</Label>
                    <Select id="task-intervalDays" value={String(value.intervalDays)} onChange={(e) => onChange({ intervalDays: Number(e.target.value) })} className="w-40">
                      {TODO_INTERVAL_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === 2 ? "andere dag" : `${n}e dag`}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="task-intervalAnchorDate">Startdag</Label>
                    <Input
                      id="task-intervalAnchorDate"
                      placeholder="DD-MM-JJJJ"
                      value={value.intervalAnchorDate}
                      onChange={(e) => onChange({ intervalAnchorDate: formatBirthDateInput(e.target.value) })}
                      className="w-40"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Create form (no plan yet) ---

function PlanForm({ clientId, onSaved, onCancel }: { clientId: string; onSaved: () => void; onCancel: () => void }) {
  const [startDate, setStartDate] = React.useState(todayDDMMYYYY());
  const [content, setContent] = React.useState<PlanContentValue>({
    goal: "",
    stepsAanwezigheid: "",
    stepsVerzet: "",
    stepsHerstelRelatie: "",
    stepsSteunSupport: "",
    stepsDeescalatie: "",
    evaluationDate: "",
  });
  const [task, setTask] = React.useState<TaskFieldsValue>(EMPTY_TASK_FIELDS);
  const [loading, setLoading] = React.useState(false);

  const complete = content.goal && content.stepsAanwezigheid && content.stepsVerzet && content.stepsHerstelRelatie && content.stepsSteunSupport && content.stepsDeescalatie && content.evaluationDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/intervention-plans", { clientId, startDate, ...content, task: taskFieldsToPayload(task) });
      toast.success("Interventieplan aangemaakt");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="plan-startDate">Startdatum</Label>
            <Input
              id="plan-startDate"
              placeholder="DD-MM-JJJJ"
              value={startDate}
              onChange={(e) => setStartDate(formatBirthDateInput(e.target.value))}
              className="w-40"
              required
            />
          </div>
          <PlanContentFields value={content} onChange={(patch) => setContent((v) => ({ ...v, ...patch }))} />
          <PlanTaskFields value={task} onChange={(patch) => setTask((v) => ({ ...v, ...patch }))} />
          <div className="flex gap-2">
            <Button type="submit" loading={loading} disabled={!complete} className="self-start">
              Plan aanmaken
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Annuleren
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// --- Evaluate flow ---

function EvaluateForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan: InterventionPlanRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [decision, setDecision] = React.useState<"CONTINUE" | "ADJUSTED" | null>(null);
  const [pillarsThatHelped, setPillarsThatHelped] = React.useState<string[]>([]);
  const [reflection, setReflection] = React.useState("");
  const [nextEvaluationDate, setNextEvaluationDate] = React.useState("");
  const [newContent, setNewContent] = React.useState<PlanContentValue>({
    goal: plan.goal,
    stepsAanwezigheid: plan.stepsAanwezigheid,
    stepsVerzet: plan.stepsVerzet,
    stepsHerstelRelatie: plan.stepsHerstelRelatie,
    stepsSteunSupport: plan.stepsSteunSupport,
    stepsDeescalatie: plan.stepsDeescalatie,
    evaluationDate: "",
  });
  const [newTask, setNewTask] = React.useState<TaskFieldsValue>(EMPTY_TASK_FIELDS);
  const [loading, setLoading] = React.useState(false);

  function togglePillar(value: string) {
    setPillarsThatHelped((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) return;
    setLoading(true);
    try {
      const base = { date: todayDDMMYYYY(), pillarsThatHelped, reflection };
      const body =
        decision === "CONTINUE"
          ? { ...base, decision: "CONTINUE" as const, nextEvaluationDate }
          : { ...base, decision: "ADJUSTED" as const, newPlan: { ...newContent, task: taskFieldsToPayload(newTask) } };
      await api(`/api/intervention-plans/${plan.id}/evaluate`, body);
      toast.success(decision === "CONTINUE" ? "Plan doorgezet" : "Plan aangepast — vorige versie gearchiveerd");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    reflection.trim() &&
    (decision === "CONTINUE"
      ? !!nextEvaluationDate
      : decision === "ADJUSTED"
        ? newContent.goal && newContent.stepsAanwezigheid && newContent.stepsVerzet && newContent.stepsHerstelRelatie && newContent.stepsSteunSupport && newContent.stepsDeescalatie && newContent.evaluationDate
        : false);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
      <p className="text-sm font-medium text-slate-100">Evaluatie — korte, concrete reflectie</p>
      <div>
        <Label>Welke pijlers hielpen merkbaar?</Label>
        <div className="flex flex-wrap gap-1.5">
          {PILLARS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => togglePillar(value)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                pillarsThatHelped.includes(value) ? "border-forest-400 bg-forest-500/15 text-forest-300" : "border-border bg-surface2 text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="eval-reflection">Korte reflectie</Label>
        <Textarea
          id="eval-reflection"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Wat merkten we? Wat werkte, wat niet — kort en concreet."
          className="min-h-[70px]"
          required
        />
      </div>
      <div>
        <Label>Besluit</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={decision === "CONTINUE" ? "secondary" : "outline"} onClick={() => setDecision("CONTINUE")}>
            Nog steeds actueel
          </Button>
          <Button type="button" size="sm" variant={decision === "ADJUSTED" ? "secondary" : "outline"} onClick={() => setDecision("ADJUSTED")}>
            Aanpassen
          </Button>
        </div>
      </div>
      {decision === "CONTINUE" && (
        <div>
          <Label htmlFor="eval-nextDate">Volgende evaluatiedatum</Label>
          <Input
            id="eval-nextDate"
            placeholder="DD-MM-JJJJ"
            value={nextEvaluationDate}
            onChange={(e) => setNextEvaluationDate(formatBirthDateInput(e.target.value))}
            className="w-40"
            required
          />
        </div>
      )}
      {decision === "ADJUSTED" && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <p className="text-xs text-slate-500">Pas aan waar nodig — dit wordt de nieuwe, actieve versie; de huidige versie blijft bewaard als archief.</p>
          <PlanContentFields value={newContent} onChange={(patch) => setNewContent((v) => ({ ...v, ...patch }))} />
          <PlanTaskFields value={newTask} onChange={(patch) => setNewTask((v) => ({ ...v, ...patch }))} />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={loading} disabled={!canSubmit} className="self-start">
          {decision === "ADJUSTED" ? "Plan aanpassen en archiveren" : "Doorzetten"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
