"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  datePartOfLocal,
  expandOccurrenceDates,
  MAX_OCCURRENCES,
  parseYmd,
  type RepeatRule,
} from "@/lib/appointment-recurrence";

export type AppointmentFormValue = {
  id: string;
  title: string;
  description: string | null;
  clientId: string | null;
  startAtLocal: string;
  endAtLocal?: string | null;
  seriesId?: string | null;
};

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

export function AppointmentForm({
  clients,
  appointment,
  defaultStart,
  onSaved,
  onCancel,
}: {
  clients: { id: string; name: string }[];
  /** Present only when editing an existing appointment; absent means "create new". */
  appointment?: AppointmentFormValue;
  /** Prefill for a new afspraak (e.g. the slot clicked in the calendar), "YYYY-MM-DDTHH:mm". */
  defaultStart?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const isEditing = !!appointment;
  const router = useRouter();
  const [title, setTitle] = React.useState(appointment?.title ?? "");
  const [description, setDescription] = React.useState(appointment?.description ?? "");
  const [clientId, setClientId] = React.useState(appointment?.clientId ?? "");
  const [startAt, setStartAt] = React.useState(appointment?.startAtLocal ?? defaultStart ?? "");
  const [endAt, setEndAt] = React.useState(appointment?.endAtLocal ?? "");
  const [loading, setLoading] = React.useState(false);
  const [scope, setScope] = React.useState<Scope>("this");

  const [repeatMode, setRepeatMode] = React.useState<RepeatMode>("none");
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [endMode, setEndMode] = React.useState<EndMode>("count");
  const [count, setCount] = React.useState("8");
  const [until, setUntil] = React.useState("");
  const [extraDates, setExtraDates] = React.useState<string[]>([]);
  const [pendingDate, setPendingDate] = React.useState("");

  const startDate = startAt ? datePartOfLocal(startAt) : "";
  const effectiveWeekdays = weekdays.length > 0 ? weekdays : startDate ? [isoWeekdayOf(startDate)] : [];

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
  }, [repeatMode, endMode, count, until, extraDates, weekdays, startDate]);

  // Live preview of exactly what will be created — same function the server uses.
  const preview = React.useMemo(() => {
    if (isEditing || repeatMode === "none" || !startDate) return null;
    try {
      return { dates: expandOccurrenceDates(startDate, rule), error: null as string | null };
    } catch (e) {
      return { dates: [] as string[], error: e instanceof RangeError ? e.message : "Ongeldige herhaling" };
    }
  }, [isEditing, repeatMode, startDate, rule]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (preview?.error) {
      toast.error(preview.error);
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { title, description, clientId, startAt, endAt };
      if (isEditing && appointment?.seriesId) body.scope = scope;
      if (!isEditing && repeatMode !== "none") body.repeat = rule;
      const res = await fetch(isEditing ? `/api/appointments/${appointment.id}` : "/api/appointments", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      toast.success(
        isEditing
          ? data.updated > 1
            ? `${data.updated} afspraken bijgewerkt`
            : "Afspraak bijgewerkt"
          : data.count > 1
            ? `${data.count} afspraken toegevoegd`
            : "Afspraak toegevoegd"
      );
      if (!isEditing) {
        setTitle("");
        setDescription("");
        setStartAt("");
        setEndAt("");
        setRepeatMode("none");
        setExtraDates([]);
      }
      router.refresh();
      onSaved?.();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  const uid = React.useId();
  const chip = (active: boolean) =>
    cn(
      "h-10 min-w-10 rounded-lg border px-2.5 text-sm font-medium transition-colors",
      active ? "border-rose-400/60 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-400 hover:text-slate-200"
    );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${uid}-title`}>Titel</Label>
          <Input id={`${uid}-title`} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
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
          <Label htmlFor={`${uid}-start`}>Begin</Label>
          <Input id={`${uid}-start`} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor={`${uid}-end`}>Einde (optioneel, anders 1 uur)</Label>
          <Input id={`${uid}-end`} type="datetime-local" value={endAt} min={startAt || undefined} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor={`${uid}-desc`}>Omschrijving (optioneel)</Label>
        <Textarea id={`${uid}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {!isEditing && (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-surface2/40 p-4">
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
                  <Input id={`${uid}-until`} type="date" value={until} min={startDate || undefined} onChange={(e) => setUntil(e.target.value)} />
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
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-surface2/40 p-4">
          <legend className="px-1 text-sm font-medium text-slate-300">Deze afspraak is onderdeel van een reeks</legend>
          {(
            [
              ["this", "Alleen deze afspraak"],
              ["following", "Deze en alle volgende"],
              ["all", "Hele reeks"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="radio" name={`${uid}-scope`} checked={scope === value} onChange={() => setScope(value)} className="accent-rose-400" />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={loading} disabled={!title || !startAt || !!preview?.error} className="self-start">
          {isEditing ? "Wijzigingen opslaan" : preview && preview.dates.length > 1 ? `${preview.dates.length} afspraken toevoegen` : "Afspraak toevoegen"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Annuleren
          </Button>
        )}
      </div>
    </form>
  );
}
