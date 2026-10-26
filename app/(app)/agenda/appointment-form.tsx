"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, toDatetimeLocalValue } from "@/lib/utils";
import { datePartOfLocal, expandOccurrenceDates, MAX_OCCURRENCES, parseYmd, type RepeatRule } from "@/lib/appointment-recurrence";
import {
  AGENDA_CATEGORIES,
  AGENDA_CATEGORY_META,
  AGENDA_DESCRIPTION_MAX,
  AGENDA_LOCATION_MAX,
  AGENDA_REMINDER_OPTIONS,
  AGENDA_TITLE_MAX,
  endMs,
  formatAgendaTime,
  type AgendaCategoryKey,
  type AgendaConflict,
  type AgendaItem,
} from "@/lib/agenda-shared";
import { api, apiMessage, CATEGORY_ICON } from "./agenda-ui";
import { useAgendaEnv } from "./agenda-env";

/** Values a new afspraak starts with (clicked slot, quick add, "dupliceren"). */
export type AppointmentPrefill = {
  title?: string;
  /** "YYYY-MM-DDTHH:mm" */
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  category?: AgendaCategoryKey | null;
  clientId?: string | null;
  assigneeId?: string | null;
  location?: string;
  description?: string;
};

export type SavedResult = { count: number; appointment: AgendaItem | null; updated?: AgendaItem[] };

type RepeatMode = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "dates";
type EndMode = "count" | "until";
type Scope = "this" | "following" | "all";

const WEEKDAYS = [
  { n: 1, label: "Ma" },
  { n: 2, label: "Di" },
  { n: 3, label: "Wo" },
  { n: 4, label: "Do" },
  { n: 5, label: "Vr" },
  { n: 6, label: "Za" },
  { n: 7, label: "Zo" },
];
const DURATIONS = [30, 45, 60, 90, 120];

function isoWeekdayOf(ymd: string): number {
  const t = parseYmd(ymd);
  if (t === null) return 1;
  const d = new Date(t).getUTCDay();
  return d === 0 ? 7 : d;
}

function formatShort(ymd: string): string {
  const t = parseYmd(ymd);
  return t === null ? ymd : new Date(t).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** Adds minutes to a wall-clock "YYYY-MM-DDTHH:mm" (calendar arithmetic, no timezone involved). */
function addMinutesLocal(local: string, minutes: number): string {
  const [d, t] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi + minutes)).toISOString().slice(0, 16);
}

function minutesBetweenLocal(a: string, b: string): number {
  const p = (v: string) => {
    const [d, t] = v.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    return Date.UTC(y, mo - 1, da, h, mi);
  };
  return Math.round((p(b) - p(a)) / 60_000);
}

function initialFrom(appointment?: AgendaItem, prefill?: AppointmentPrefill) {
  if (appointment) {
    const start = new Date(appointment.startAt);
    const startLocal = toDatetimeLocalValue(start);
    const lastDay = toDatetimeLocalValue(new Date(Math.max(start.getTime(), endMs(appointment) - 1))).slice(0, 10);
    return {
      title: appointment.title,
      description: appointment.description ?? "",
      location: appointment.location ?? "",
      category: appointment.category,
      clientId: appointment.clientId ?? "",
      assigneeId: appointment.assigneeId ?? "",
      allDay: appointment.allDay,
      startAt: appointment.allDay ? `${startLocal.slice(0, 10)}T09:00` : startLocal,
      endAt: !appointment.allDay && appointment.endAt ? toDatetimeLocalValue(new Date(appointment.endAt)) : "",
      startDay: startLocal.slice(0, 10),
      endDay: lastDay,
      remind: appointment.remindMinutes === null ? "" : String(appointment.remindMinutes),
    };
  }
  const startAt = prefill?.startAt ?? "";
  return {
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    location: prefill?.location ?? "",
    category: prefill?.category ?? null,
    clientId: prefill?.clientId ?? "",
    assigneeId: prefill?.assigneeId ?? "",
    allDay: prefill?.allDay ?? false,
    startAt,
    endAt: prefill?.endAt ?? "",
    startDay: startAt.slice(0, 10),
    endDay: (prefill?.endAt ?? startAt).slice(0, 10),
    remind: "",
  };
}

export function AppointmentForm({
  appointment,
  prefill,
  onSaved,
  onCancel,
  onDirty,
}: {
  /** Present only when editing an existing afspraak; absent means "create new". */
  appointment?: AgendaItem;
  prefill?: AppointmentPrefill;
  onSaved: (result: SavedResult) => void;
  onCancel?: () => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const { clients, staff, viewerId } = useAgendaEnv();
  const isEditing = !!appointment;
  const init = React.useMemo(() => initialFrom(appointment, prefill), [appointment, prefill]);

  const [title, setTitle] = React.useState(init.title);
  const [description, setDescription] = React.useState(init.description);
  const [location, setLocation] = React.useState(init.location);
  const [category, setCategory] = React.useState<AgendaCategoryKey | null>(init.category);
  const [clientId, setClientId] = React.useState(init.clientId);
  const [assigneeId, setAssigneeId] = React.useState(init.assigneeId);
  const [allDay, setAllDay] = React.useState(init.allDay);
  const [startAt, setStartAt] = React.useState(init.startAt);
  const [endAt, setEndAt] = React.useState(init.endAt);
  const [startDay, setStartDay] = React.useState(init.startDay);
  const [endDay, setEndDay] = React.useState(init.endDay);
  const [remind, setRemind] = React.useState(init.remind);
  const [scope, setScope] = React.useState<Scope>("this");
  const [loading, setLoading] = React.useState(false);
  const [stale, setStale] = React.useState<AgendaItem | null>(null);
  const [conflicts, setConflicts] = React.useState<AgendaConflict[]>([]);

  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>("none");
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [endMode, setEndMode] = React.useState<EndMode>("count");
  const [count, setCount] = React.useState("8");
  const [until, setUntil] = React.useState("");
  const [extraDates, setExtraDates] = React.useState<string[]>([]);
  const [pendingDate, setPendingDate] = React.useState("");

  // Report "has unsaved input" upwards, so closing the sheet can ask first.
  const dirty =
    title !== init.title || description !== init.description || location !== init.location || category !== init.category || clientId !== init.clientId ||
    assigneeId !== init.assigneeId || allDay !== init.allDay || startAt !== init.startAt || endAt !== init.endAt || startDay !== init.startDay ||
    endDay !== init.endDay || remind !== init.remind || repeatMode !== "none";
  React.useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  const firstDate = allDay ? startDay : startAt ? datePartOfLocal(startAt) : "";
  const effectiveWeekdays = weekdays.length > 0 ? weekdays : firstDate ? [isoWeekdayOf(firstDate)] : [];

  const rule: RepeatRule = React.useMemo(() => {
    switch (repeatMode) {
      case "none":
        return { mode: "none" };
      case "dates":
        return { mode: "dates", dates: extraDates };
      case "monthly":
      case "daily":
        return endMode === "count" ? { mode: repeatMode, count: Number(count) || undefined } : { mode: repeatMode, until: until || undefined };
      default:
        return endMode === "count"
          ? { mode: repeatMode, weekdays: effectiveWeekdays, count: Number(count) || undefined }
          : { mode: repeatMode, weekdays: effectiveWeekdays, until: until || undefined };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatMode, endMode, count, until, extraDates, weekdays, firstDate]);

  // Live preview of exactly what will be created — the same function the server uses.
  const preview = React.useMemo(() => {
    if (isEditing || repeatMode === "none" || !firstDate) return null;
    try {
      return { dates: expandOccurrenceDates(firstDate, rule), error: null as string | null };
    } catch (e) {
      return { dates: [] as string[], error: e instanceof RangeError ? e.message : "Ongeldige herhaling" };
    }
  }, [isEditing, repeatMode, firstDate, rule]);

  const wireStart = allDay ? (startDay ? `${startDay}T00:00` : "") : startAt;
  const wireEnd = allDay ? (endDay && endDay > startDay ? `${endDay}T00:00` : "") : endAt;
  const timeError = !allDay && startAt && endAt && endAt <= startAt ? "De eindtijd moet na de begintijd liggen" : allDay && startDay && endDay && endDay < startDay ? "De einddatum moet op of na de begindatum liggen" : null;

  // Overlap hint (cliënt in two places, begeleider op twee afspraken) — debounced, never blocking.
  React.useEffect(() => {
    if (!wireStart || timeError || (!clientId && !assigneeId)) {
      setConflicts([]);
      return;
    }
    const params = new URLSearchParams({ startAt: wireStart, allDay: allDay ? "1" : "0" });
    if (wireEnd) params.set("endAt", wireEnd);
    if (clientId) params.set("clientId", clientId);
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (appointment) params.set("exclude", appointment.id);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await api(`/api/appointments/conflicts?${params}`);
      if (!cancelled) setConflicts(res.ok ? res.data.conflicts : []);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [wireStart, wireEnd, allDay, clientId, assigneeId, appointment, timeError]);

  function toggleAllDay(next: boolean) {
    setAllDay(next);
    if (next) {
      const day = startAt ? datePartOfLocal(startAt) : startDay;
      setStartDay(day);
      setEndDay(endAt && datePartOfLocal(endAt) > day ? datePartOfLocal(endAt) : day);
    } else if (startDay) {
      setStartAt(`${startDay}T${startAt.slice(11, 16) || "09:00"}`);
    }
  }

  function toggleWeekday(n: number) {
    setWeekdays((prev) => {
      const base = prev.length > 0 ? prev : effectiveWeekdays;
      return base.includes(n) ? base.filter((d) => d !== n) : [...base, n].sort();
    });
  }

  function addPendingDate() {
    if (!pendingDate || parseYmd(pendingDate) === null) return;
    setExtraDates((prev) => (prev.includes(pendingDate) || prev.length >= MAX_OCCURRENCES ? prev : [...prev, pendingDate].sort()));
    setPendingDate("");
  }

  function loadCurrent(current: AgendaItem) {
    const next = initialFrom(current);
    setTitle(next.title);
    setDescription(next.description);
    setLocation(next.location);
    setCategory(next.category);
    setClientId(next.clientId);
    setAllDay(next.allDay);
    setStartAt(next.startAt);
    setEndAt(next.endAt);
    setStartDay(next.startDay);
    setEndDay(next.endDay);
    setRemind(next.remind);
    setStale(null);
  }

  async function save(force = false) {
    if (preview?.error || timeError) {
      toast.error(preview?.error ?? timeError ?? "Controleer de invoer");
      return;
    }
    setLoading(true);
    const body: Record<string, unknown> = {
      title,
      description,
      location,
      category: category ?? "",
      clientId,
      startAt: wireStart,
      endAt: wireEnd,
      allDay,
      remindMinutes: remind === "" ? null : Number(remind),
    };
    if (isEditing) {
      if (appointment?.seriesId) body.scope = scope;
      body.version = appointment?.version;
      if (force) body.force = true;
    } else {
      body.assigneeId = assigneeId;
      if (repeatMode !== "none") body.repeat = rule;
    }
    const res = await api(isEditing ? `/api/appointments/${appointment!.id}` : "/api/appointments", isEditing ? "PATCH" : "POST", body);
    setLoading(false);
    if (res.status === 409 && res.data?.conflict) {
      setStale(res.data.current as AgendaItem);
      return;
    }
    if (!res.ok) {
      toast.error(apiMessage(res, "Opslaan mislukt"));
      return;
    }
    onDirty?.(false);
    onSaved({ count: res.data.count ?? res.data.updated ?? 1, appointment: res.data.appointment ?? null });
  }

  const uid = React.useId();
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors",
      active ? "border-rose-400/60 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-400 hover:text-slate-200"
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void save();
        }
      }}
      className="flex flex-col gap-4"
    >
      {stale && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Een collega heeft deze afspraak zojuist gewijzigd.
          </p>
          <p className="text-amber-200/80">
            Nu staat er: <strong>{stale.title}</strong>, {formatAgendaTime(stale)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => loadCurrent(stale)}>
              Nieuwste versie laden
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void save(true)}>
              Toch mijn versie opslaan
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor={`${uid}-title`}>Titel</Label>
        <Input id={`${uid}-title`} value={title} maxLength={AGENDA_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} required autoFocus={!isEditing} />
        <p className="mt-1 text-xs text-slate-500">Houd de titel kort (&quot;Tandarts&quot;). Details horen in de omschrijving.</p>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-300">Soort</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Soort afspraak">
          {AGENDA_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <button key={c} type="button" aria-pressed={category === c} title={AGENDA_CATEGORY_META[c].hint} onClick={() => setCategory(category === c ? null : c)} className={chip(category === c)}>
                <Icon className="h-4 w-4" /> {AGENDA_CATEGORY_META[c].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${uid}-client`}>Cliënt (optioneel)</Label>
          <Select id={`${uid}-client`} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Geen</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${uid}-assignee`}>Wie gaat mee?</Label>
          {isEditing ? (
            <p id={`${uid}-assignee`} className="flex h-11 items-center rounded-xl border border-border bg-surface2/50 px-3 text-sm text-slate-400">
              {appointment?.assigneeName ?? "Nog niemand"} · wijzig in het detailscherm
            </p>
          ) : (
            <Select id={`${uid}-assignee`} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Nog niemand</option>
              {viewerId && <option value={viewerId}>Ik</option>}
              {staff
                .filter((s) => s.id !== viewerId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-surface2/30 p-4">
        <legend className="px-1 text-sm font-medium text-slate-300">Wanneer</legend>
        <Checkbox checked={allDay} onChange={toggleAllDay} className="min-h-11">
          Hele dag
        </Checkbox>
        {allDay ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${uid}-sd`}>Van</Label>
              <Input id={`${uid}-sd`} type="date" value={startDay} onChange={(e) => { setStartDay(e.target.value); if (endDay < e.target.value) setEndDay(e.target.value); }} required />
            </div>
            <div>
              <Label htmlFor={`${uid}-ed`}>Tot en met</Label>
              <Input id={`${uid}-ed`} type="date" value={endDay} min={startDay || undefined} onChange={(e) => setEndDay(e.target.value)} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${uid}-start`}>Begin</Label>
                <Input id={`${uid}-start`} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required step={300} />
              </div>
              <div>
                <Label htmlFor={`${uid}-end`}>Einde (optioneel, anders 1 uur)</Label>
                <Input id={`${uid}-end`} type="datetime-local" value={endAt} min={startAt || undefined} onChange={(e) => setEndAt(e.target.value)} step={300} />
              </div>
            </div>
            {startAt && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Duur kiezen">
                <span className="text-xs text-slate-500">Duur:</span>
                {DURATIONS.map((m) => {
                  const active = endAt !== "" && minutesBetweenLocal(startAt, endAt) === m;
                  return (
                    <button key={m} type="button" aria-pressed={active} onClick={() => setEndAt(addMinutesLocal(startAt, m))} className={cn(chip(active), "h-8 text-xs")}>
                      {m < 60 ? `${m} min` : `${m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toString().replace(".", ",")} uur`}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {timeError && (
          <p role="alert" className="text-sm text-red-400">
            {timeError}
          </p>
        )}
      </fieldset>

      {conflicts.length > 0 && (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Let op: dit overlapt met
          </p>
          <ul className="list-disc pl-6 text-amber-200/90">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.title} ({formatAgendaTime(c)}) — {c.reason === "client" ? "dezelfde cliënt" : "dezelfde begeleider"}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-200/70">Opslaan kan gewoon; dit is alleen een waarschuwing.</p>
        </div>
      )}

      <div>
        <Label htmlFor={`${uid}-loc`}>Locatie (optioneel)</Label>
        <Input id={`${uid}-loc`} value={location} maxLength={AGENDA_LOCATION_MAX} onChange={(e) => setLocation(e.target.value)} placeholder="Bijv. huisartsenpraktijk, Dorpsstraat 4" />
      </div>
      <div>
        <Label htmlFor={`${uid}-desc`}>Omschrijving (optioneel)</Label>
        <Textarea id={`${uid}-desc`} value={description} maxLength={AGENDA_DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <Label htmlFor={`${uid}-remind`}>Herinnering</Label>
        <Select id={`${uid}-remind`} value={remind} onChange={(e) => setRemind(e.target.value)} disabled={allDay}>
          {AGENDA_REMINDER_OPTIONS.map((o) => (
            <option key={String(o.value)} value={o.value === null ? "" : String(o.value)}>
              {o.label}
            </option>
          ))}
        </Select>
        {allDay && <p className="mt-1 text-xs text-slate-500">Een hele dag geeft geen herinnering op een vast tijdstip.</p>}
      </div>

      {!isEditing && (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-surface2/30 p-4">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-slate-300">
            <Repeat className="h-4 w-4" /> Herhaling
          </legend>
          <Select aria-label="Herhaling" value={repeatMode} onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}>
            <option value="none">Eenmalig</option>
            <option value="daily">Elke dag</option>
            <option value="weekly">Elke week</option>
            <option value="biweekly">Om de week</option>
            <option value="monthly">Elke maand (zelfde dag)</option>
            <option value="dates">Losse datums kiezen</option>
          </Select>

          {(repeatMode === "weekly" || repeatMode === "biweekly") && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Op welke dagen">
              {WEEKDAYS.map((d) => (
                <button key={d.n} type="button" aria-pressed={effectiveWeekdays.includes(d.n)} onClick={() => toggleWeekday(d.n)} className={chip(effectiveWeekdays.includes(d.n))}>
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {repeatMode !== "none" && repeatMode !== "dates" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${uid}-endmode`}>Eindigt</Label>
                <Select id={`${uid}-endmode`} value={endMode} onChange={(e) => setEndMode(e.target.value as EndMode)}>
                  <option value="count">Na aantal keer</option>
                  <option value="until">Op een datum</option>
                </Select>
              </div>
              {endMode === "count" ? (
                <div>
                  <Label htmlFor={`${uid}-count`}>Aantal afspraken</Label>
                  <Input id={`${uid}-count`} type="number" min={2} max={MAX_OCCURRENCES} value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
              ) : (
                <div>
                  <Label htmlFor={`${uid}-until`}>Laatste datum</Label>
                  <Input id={`${uid}-until`} type="date" value={until} min={firstDate || undefined} onChange={(e) => setUntil(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {repeatMode === "dates" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input aria-label="Extra datum" type="date" value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} />
                <Button type="button" variant="outline" onClick={addPendingDate} disabled={!pendingDate}>
                  Toevoegen
                </Button>
              </div>
              <p className="text-xs text-slate-500">Dezelfde tijd op elke gekozen datum, naast de begindatum hierboven.</p>
              <div className="flex flex-wrap gap-1.5">
                {extraDates.map((d) => (
                  <span key={d} className="flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-xs text-slate-300">
                    {formatShort(d)}
                    <button type="button" aria-label={`Verwijder ${d}`} onClick={() => setExtraDates((prev) => prev.filter((x) => x !== d))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <p className={cn("text-sm", preview.error ? "text-red-300" : "text-slate-400")} aria-live="polite">
              {preview.error
                ? preview.error
                : `${preview.dates.length} afspraken: ${formatShort(preview.dates[0])}${preview.dates.length > 1 ? ` t/m ${formatShort(preview.dates[preview.dates.length - 1])}` : ""}`}
            </p>
          )}
        </fieldset>
      )}

      {isEditing && appointment?.seriesId && (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-surface2/30 p-4">
          <legend className="px-1 text-sm font-medium text-slate-300">Deze afspraak is onderdeel van een reeks</legend>
          {(
            [
              ["this", "Alleen deze afspraak"],
              ["following", "Deze en alle volgende"],
              ["all", "Hele reeks"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-10 items-center gap-2.5 text-sm text-slate-300">
              <input type="radio" name={`${uid}-scope`} checked={scope === value} onChange={() => setScope(value)} className="h-4 w-4 accent-rose-400" />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" loading={loading} disabled={!title.trim() || !wireStart || !!preview?.error || !!timeError}>
          {isEditing ? "Wijzigingen opslaan" : preview && preview.dates.length > 1 ? `${preview.dates.length} afspraken toevoegen` : "Afspraak toevoegen"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Annuleren
          </Button>
        )}
        <span className="ml-auto hidden text-xs text-slate-600 sm:inline">⌘/Ctrl + Enter om op te slaan</span>
      </div>
    </form>
  );
}
