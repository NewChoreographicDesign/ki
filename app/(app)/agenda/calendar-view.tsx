"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn, getZonedParts, toDatetimeLocalValue, formatDateTime } from "@/lib/utils";
import { colorForClient } from "@/lib/agenda-colors";
import { AppointmentForm } from "./appointment-form";

type ApiAppointment = {
  id: string;
  title: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  startAt: string;
  endAt: string | null;
  seriesId: string | null;
};

type View = "dag" | "week" | "maand";
const TZ = "Europe/Amsterdam";
const HOUR_H = 52;
const DEFAULT_MIN = 60;
const DAY_MS = 86_400_000;
const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];

// --- date helpers on plain "YYYY-MM-DD" strings (Amsterdam calendar days) ---
const ymdToUtc = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
const utcToYmd = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => utcToYmd(ymdToUtc(ymd) + n * DAY_MS);
const isoWeekdayIdx = (ymd: string) => (new Date(ymdToUtc(ymd)).getUTCDay() + 6) % 7; // 0 = Monday
const mondayOf = (ymd: string) => addDays(ymd, -isoWeekdayIdx(ymd));
function ymdOf(date: Date): string {
  const p = getZonedParts(date, TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
const minutesOf = (date: Date) => {
  const p = getZonedParts(date, TZ);
  return p.hour * 60 + p.minute;
};
const fmtHM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const labelDay = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(ymdToUtc(ymd)).toLocaleDateString("nl-NL", { ...opts, timeZone: "UTC" });

/** A calendar block for ONE day (a multi-day afspraak yields one per day). */
type Block = { key: string; ymd: string; startMin: number; endMin: number; appt: ApiAppointment };

function toBlocks(a: ApiAppointment): Block[] {
  const start = new Date(a.startAt);
  const end = a.endAt ? new Date(a.endAt) : new Date(start.getTime() + DEFAULT_MIN * 60_000);
  const firstDay = ymdOf(start);
  const lastDay = ymdOf(new Date(Math.max(start.getTime(), end.getTime() - 1)));
  const blocks: Block[] = [];
  for (let day = firstDay, i = 0; day <= lastDay && i < 14; day = addDays(day, 1), i++) {
    blocks.push({
      key: `${a.id}-${day}`,
      ymd: day,
      startMin: day === firstDay ? minutesOf(start) : 0,
      endMin: day === lastDay ? Math.max(minutesOf(end), (day === firstDay ? minutesOf(start) : 0) + 15) : 24 * 60,
      appt: a,
    });
  }
  return blocks;
}

/** Side-by-side columns for overlapping blocks in one day (Outlook-style). */
function layoutDay(blocks: Block[]): { block: Block; col: number; cols: number }[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: { block: Block; col: number; cols: number }[] = [];
  let cluster: { block: Block; col: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) out.push({ ...c, cols });
    cluster = [];
  };
  for (const block of sorted) {
    if (cluster.length > 0 && block.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const taken = new Set(cluster.filter((c) => c.block.endMin > block.startMin).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ block, col });
    clusterEnd = Math.max(clusterEnd, block.endMin);
  }
  flush();
  return out;
}

export function CalendarView({ clients }: { clients: { id: string; name: string }[] }) {
  const todayYmd = ymdOf(new Date());
  const [view, setView] = React.useState<View>("week");
  const [anchor, setAnchor] = React.useState(todayYmd);
  const [items, setItems] = React.useState<ApiAppointment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<ApiAppointment | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [creating, setCreating] = React.useState<string | null>(null); // default start "YYYY-MM-DDTHH:mm"
  const [now, setNow] = React.useState(() => new Date());
  const [scopePrompt, setScopePrompt] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Phones get the day view with a week strip (like the phone calendar);
  // wider screens the week grid. Decided after mount to keep SSR identical.
  React.useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("dag");
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const range = React.useMemo(() => {
    if (view === "dag") return { from: anchor, to: addDays(anchor, 1) };
    if (view === "week") return { from: mondayOf(anchor), to: addDays(mondayOf(anchor), 7) };
    const first = `${anchor.slice(0, 8)}01`;
    return { from: mondayOf(first), to: addDays(mondayOf(first), 42) };
  }, [view, anchor]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      // Pad by a day each side so Amsterdam-vs-UTC day edges never clip a block.
      const from = new Date(ymdToUtc(range.from) - DAY_MS).toISOString();
      const to = new Date(ymdToUtc(range.to) + DAY_MS).toISOString();
      const res = await fetch(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden mislukt");
      setItems(data.appointments);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agenda laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const colorKey = (a: ApiAppointment) => a.clientId ?? "none";
  const legend = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; clientId: string | null }>();
    for (const a of items) if (!map.has(colorKey(a))) map.set(colorKey(a), { key: colorKey(a), label: a.clientName ?? "Zonder cliënt", clientId: a.clientId });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "nl"));
  }, [items]);

  const blocksByDay = React.useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const a of items) {
      if (hidden.has(colorKey(a))) continue;
      for (const b of toBlocks(a)) {
        const list = map.get(b.ymd);
        if (list) list.push(b);
        else map.set(b.ymd, [b]);
      }
    }
    return map;
  }, [items, hidden]);

  // Land on the working day's start (07:00) instead of midnight.
  React.useEffect(() => {
    if (view !== "maand" && scrollRef.current) scrollRef.current.scrollTop = HOUR_H * 7 - 8;
  }, [view, loading]);

  function step(dir: -1 | 1) {
    if (view === "dag") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const t = new Date(ymdToUtc(anchor));
      setAnchor(utcToYmd(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + dir, 1)));
    }
  }

  const title =
    view === "dag"
      ? labelDay(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : view === "week"
        ? `${labelDay(mondayOf(anchor), { day: "numeric", month: "short" })} – ${labelDay(addDays(mondayOf(anchor), 6), { day: "numeric", month: "short", year: "numeric" })}`
        : labelDay(anchor, { month: "long", year: "numeric" });

  const days = view === "dag" ? [anchor] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i)) : [];
  const nowYmd = ymdOf(now);
  const nowMin = minutesOf(now);

  function openSlot(ymd: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.min(23 * 60 + 30, Math.max(0, Math.round((((e.clientY - rect.top) / HOUR_H) * 60) / 30) * 30));
    setCreating(`${ymd}T${fmtHM(minutes)}`);
  }

  function newNow() {
    const m = Math.min(22 * 60, Math.ceil((minutesOf(new Date()) + 1) / 60) * 60);
    setCreating(`${todayYmd}T${fmtHM(m)}`);
  }

  async function removeSelected(scope: "this" | "following" | "all") {
    if (!selected) return;
    setScopePrompt(false);
    const res = await fetch(`/api/appointments/${selected.id}?scope=${scope}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Verwijderen mislukt");
      return;
    }
    toast.success(scope === "this" ? "Afspraak verwijderd" : "Afspraken verwijderd");
    setSelected(null);
    void load();
  }

  const selectedForm = selected && {
    id: selected.id,
    title: selected.title,
    description: selected.description,
    clientId: selected.clientId,
    startAtLocal: toDatetimeLocalValue(new Date(selected.startAt)),
    endAtLocal: selected.endAt ? toDatetimeLocalValue(new Date(selected.endAt)) : null,
    seriesId: selected.seriesId,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(todayYmd)}>
          Vandaag
        </Button>
        <div className="flex">
          <Button type="button" variant="ghost" size="icon" aria-label="Vorige" onClick={() => step(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Volgende" onClick={() => step(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold capitalize text-slate-100 sm:text-lg" aria-live="polite">
          {title}
        </h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-label="Laden" />}
        <div role="tablist" aria-label="Weergave" className="flex rounded-xl border border-border bg-surface2/60 p-0.5">
          {(["dag", "week", "maand"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" onClick={newNow} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nieuw
        </Button>
      </div>

      {/* Colour legend doubles as a per-cliënt filter */}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter op cliënt">
          {legend.map((l) => {
            const c = colorForClient(l.clientId);
            const off = hidden.has(l.key);
            return (
              <button
                key={l.key}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.key)) next.delete(l.key);
                    else next.add(l.key);
                    return next;
                  })
                }
                className={cn("flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-slate-300 transition-opacity", off && "opacity-40")}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.dot }} />
                {l.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Phone: week strip above the day view */}
      {view === "dag" && (
        <div className="grid grid-cols-7 gap-1 md:hidden">
          {Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i)).map((d) => {
            const has = (blocksByDay.get(d)?.length ?? 0) > 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setAnchor(d)}
                aria-current={d === anchor ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs transition-colors",
                  d === anchor ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:bg-surface2"
                )}
              >
                <span className="uppercase">{WEEKDAY_SHORT[isoWeekdayIdx(d)]}</span>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", d === todayYmd && "bg-rose-500 text-white")}>{Number(d.slice(8))}</span>
                <span className={cn("h-1 w-1 rounded-full", has ? "bg-rose-400" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      )}

      {view === "maand" ? (
        <MonthGrid
          anchor={anchor}
          todayYmd={todayYmd}
          blocksByDay={blocksByDay}
          onPickDay={(d) => {
            setAnchor(d);
            setView("dag");
          }}
          onPickEvent={(a) => {
            setSelected(a);
            setEditing(false);
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Day headers */}
          <div className="flex border-b border-border bg-surface2/40">
            <div className="w-12 shrink-0" />
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setAnchor(d);
                  setView("dag");
                }}
                className={cn("min-w-0 flex-1 border-l border-border px-1 py-2 text-center text-xs", view === "dag" && "max-md:hidden")}
              >
                <span className="uppercase text-slate-500">{WEEKDAY_SHORT[isoWeekdayIdx(d)]}</span>{" "}
                <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold", d === todayYmd ? "bg-rose-500 text-white" : "text-slate-200")}>
                  {Number(d.slice(8))}
                </span>
              </button>
            ))}
          </div>
          {/* Time grid */}
          <div ref={scrollRef} className="relative max-h-[68vh] overflow-y-auto">
            <div className="relative flex" style={{ height: HOUR_H * 24 }}>
              <div className="w-12 shrink-0">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="relative text-right text-[11px] text-slate-500" style={{ height: HOUR_H }}>
                    {h > 0 && <span className="absolute -top-2 right-1.5">{fmtHM(h * 60)}</span>}
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const laid = layoutDay(blocksByDay.get(d) ?? []);
                return (
                  <div
                    key={d}
                    className="relative min-w-0 flex-1 cursor-cell border-l border-border"
                    onClick={(e) => e.target === e.currentTarget && openSlot(d, e)}
                    role="presentation"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="pointer-events-none border-t border-border/60" style={{ height: HOUR_H }} />
                    ))}
                    {laid.map(({ block, col, cols }) => {
                      const c = colorForClient(block.appt.clientId);
                      const height = Math.max(22, ((block.endMin - block.startMin) / 60) * HOUR_H - 2);
                      return (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => {
                            setSelected(block.appt);
                            setEditing(false);
                          }}
                          className="absolute overflow-hidden rounded-lg border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                          style={{
                            top: (block.startMin / 60) * HOUR_H + 1,
                            height,
                            left: `calc(${(col / cols) * 100}% + 1px)`,
                            width: `calc(${100 / cols}% - 3px)`,
                            background: c.bg,
                            borderColor: c.border,
                            color: c.text,
                          }}
                        >
                          <span className="block truncate font-semibold">{block.appt.title}</span>
                          {height > 34 && (
                            <span className="block truncate opacity-80">
                              {fmtHM(block.startMin)}
                              {block.appt.clientName ? ` · ${block.appt.clientName}` : ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {d === nowYmd && (
                      <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMin / 60) * HOUR_H }}>
                        <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                        <span className="h-px flex-1 bg-rose-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Event detail / edit */}
      <Modal
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          setEditing(false);
          setScopePrompt(false);
        }}
        title={editing ? "Afspraak bewerken" : "Afspraak"}
      >
        {selected && selectedForm && !editing && !scopePrompt && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: colorForClient(selected.clientId).dot }} />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-50">{selected.title}</p>
                <p className="text-sm text-slate-400">
                  {formatDateTime(new Date(selected.startAt))}
                  {selected.endAt ? ` – ${fmtHM(minutesOf(new Date(selected.endAt)))}` : ""}
                </p>
                {selected.clientName && <p className="text-sm text-slate-300">{selected.clientName}</p>}
                {selected.seriesId && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Repeat className="h-3 w-3" /> Onderdeel van een reeks
                  </p>
                )}
                {selected.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{selected.description}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Bewerken
              </Button>
              <Button
                variant="ghost"
                className="gap-1.5 text-red-400 hover:text-red-300"
                onClick={() => (selected.seriesId ? setScopePrompt(true) : void removeSelected("this"))}
              >
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
            </div>
          </div>
        )}
        {selected && scopePrompt && (
          <div className="flex flex-col gap-2">
            <p className="mb-2 text-sm text-slate-400">Deze afspraak is onderdeel van een reeks. Wat wil je verwijderen?</p>
            <Button variant="outline" onClick={() => removeSelected("this")}>
              Alleen deze afspraak
            </Button>
            <Button variant="outline" onClick={() => removeSelected("following")}>
              Deze en alle volgende
            </Button>
            <Button variant="danger" onClick={() => removeSelected("all")}>
              Hele reeks
            </Button>
          </div>
        )}
        {selected && selectedForm && editing && (
          <AppointmentForm
            clients={clients}
            appointment={selectedForm}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setSelected(null);
              setEditing(false);
              void load();
            }}
          />
        )}
      </Modal>

      {/* Create */}
      <Modal open={creating !== null} onClose={() => setCreating(null)} title="Nieuwe afspraak">
        {creating && (
          <AppointmentForm
            clients={clients}
            defaultStart={creating}
            onCancel={() => setCreating(null)}
            onSaved={() => {
              setCreating(null);
              void load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function MonthGrid({
  anchor,
  todayYmd,
  blocksByDay,
  onPickDay,
  onPickEvent,
}: {
  anchor: string;
  todayYmd: string;
  blocksByDay: Map<string, Block[]>;
  onPickDay: (ymd: string) => void;
  onPickEvent: (a: ApiAppointment) => void;
}) {
  const first = `${anchor.slice(0, 8)}01`;
  const start = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells.slice(35).every((d) => d.slice(0, 7) !== anchor.slice(0, 7)) ? 5 : 6;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-surface2/40 text-center text-xs uppercase text-slate-500">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.slice(0, weeks * 7).map((d) => {
          const blocks = [...(blocksByDay.get(d) ?? [])].sort((a, b) => a.startMin - b.startMin);
          const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
          return (
            <div key={d} className={cn("min-h-[5.5rem] border-b border-l border-border p-1 sm:min-h-[6.5rem]", !inMonth && "bg-surface2/20")}>
              <button
                type="button"
                onClick={() => onPickDay(d)}
                className={cn(
                  "mb-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold",
                  d === todayYmd ? "bg-rose-500 text-white" : inMonth ? "text-slate-200 hover:bg-surface2" : "text-slate-600"
                )}
              >
                {Number(d.slice(8))}
              </button>
              <div className="flex flex-col gap-0.5">
                {blocks.slice(0, 3).map((b) => {
                  const c = colorForClient(b.appt.clientId);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => onPickEvent(b.appt)}
                      className="truncate rounded px-1 text-left text-[10px] leading-4 sm:text-[11px]"
                      style={{ background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}` }}
                    >
                      <span className="hidden sm:inline">{fmtHM(b.startMin)} </span>
                      {b.appt.title}
                    </button>
                  );
                })}
                {blocks.length > 3 && (
                  <button type="button" onClick={() => onPickDay(d)} className="text-left text-[10px] text-slate-500 hover:text-slate-300">
                    +{blocks.length - 3} meer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
