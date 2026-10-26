"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover } from "./agenda-popover";
import { amsterdamDate, cn, parseDatetimeLocalAsAmsterdam, toDatetimeLocalValue } from "@/lib/utils";
import {
  activeFilterCount,
  agendaRange,
  type AgendaViewKey,
  applyFilters,
  AGENDA_CATEGORIES,
  AGENDA_CATEGORY_META,
  EMPTY_FILTERS,
  formatAgendaTime,
  summarizeAgenda,
  ymdOfInstant,
  type AgendaCategoryKey,
  type AgendaClientOption,
  type AgendaFilters,
  type AgendaItem,
  type AgendaStaffOption,
} from "@/lib/agenda-shared";
import { addDaysISO, amsterdamNow, weekdayOfISO } from "@/lib/date-shared";
import { colorForCategory, colorForClient } from "@/lib/agenda-colors";
import { api, apiMessage, isTypingTarget, type ColorMode } from "./agenda-ui";
import { AgendaEnvProvider, useAgendaEnv } from "./agenda-env";
import { AgendaList } from "./agenda-list";
import { AgendaGrid, type MovePatch } from "./agenda-grid";
import { AgendaMonth } from "./agenda-month";
import { AppointmentForm, type AppointmentPrefill, type SavedResult } from "./appointment-form";
import { AppointmentSheet } from "./appointment-sheet";
import { QuickAdd } from "./quick-add";

type AgendaView = AgendaViewKey;

const POLL_MS = 30_000;
const LIST_STEP_DAYS = 14;
const LIST_MAX_DAYS = 182;
const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const COLOR_KEY = "agenda-color-mode";

const at = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return amsterdamDate(y, m, d).toISOString();
};
const mondayOf = (ymd: string) => addDaysISO(ymd, -weekdayOfISO(ymd));
const monthLabel = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("nl-NL", { ...opts, timeZone: "UTC" });

type FormState = { mode: "create"; prefill: AppointmentPrefill } | { mode: "edit"; item: AgendaItem } | null;

export function AgendaApp(props: {
  initialItems: AgendaItem[];
  initialRange: { from: string; to: string };
  serverNow: number;
  initialView: AgendaView;
  viewExplicit: boolean;
  initialDate: string | null;
  clients: AgendaClientOption[];
  staff: AgendaStaffOption[];
  viewerId: string;
  canSupervise: boolean;
}) {
  const { serverNow, clients, staff, viewerId, canSupervise } = props;
  return (
    <AgendaEnvProvider serverNow={serverNow} clients={clients} staff={staff} viewerId={viewerId} canSupervise={canSupervise}>
      <AgendaInner initialItems={props.initialItems} initialRange={props.initialRange} initialView={props.initialView} viewExplicit={props.viewExplicit} initialDate={props.initialDate} />
    </AgendaEnvProvider>
  );
}

function AgendaInner({
  initialItems,
  initialRange,
  initialView,
  viewExplicit,
  initialDate,
}: {
  initialItems: AgendaItem[];
  initialRange: { from: string; to: string };
  initialView: AgendaView;
  viewExplicit: boolean;
  initialDate: string | null;
}) {
  const { clients, viewerId, nowMs } = useAgendaEnv();
  const today = amsterdamNow(nowMs).dateISO;

  const [view, setView] = React.useState<AgendaView>(initialView);
  const [anchor, setAnchor] = React.useState(initialDate ?? today);
  const [listDays, setListDays] = React.useState(LIST_STEP_DAYS);
  const [items, setItems] = React.useState<AgendaItem[]>(initialItems);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<AgendaFilters>(EMPTY_FILTERS);
  const [colorMode, setColorMode] = React.useState<ColorMode>("client");
  const [selected, setSelected] = React.useState<AgendaItem | null>(null);
  const [form, setForm] = React.useState<FormState>(null);
  const [isPhone, setIsPhone] = React.useState(false);

  const quickRef = React.useRef<HTMLInputElement>(null);
  const dirtyRef = React.useRef(false);
  const requestId = React.useRef(0);
  const usedInitial = React.useRef(false);

  const range = React.useMemo(() => agendaRange(view, anchor, today, listDays), [view, anchor, today, listDays]);

  // Per-viewer conveniences only (the screen works without them): colour mode.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(COLOR_KEY);
      if (stored === "client" || stored === "category") setColorMode(stored);
    } catch {
      /* storage can be unavailable */
    }
  }, []);
  function chooseColorMode(mode: ColorMode) {
    setColorMode(mode);
    try {
      localStorage.setItem(COLOR_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  // Phones start on the day view in the calendar tabs, like the phone calendar.
  React.useEffect(() => {
    const phone = window.matchMedia("(max-width: 767px)").matches;
    setIsPhone(phone);
    // On a phone the day (with its week strip) reads better than seven cramped columns.
    if (phone && !viewExplicit && initialView === "week") setView("dag");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Loading -------------------------------------------------------------------
  const load = React.useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const id = ++requestId.current;
      if (!opts.silent) setLoading(true);
      const res = await api(`/api/appointments?from=${encodeURIComponent(at(range.from))}&to=${encodeURIComponent(at(range.to))}`);
      if (id !== requestId.current) return; // a newer request superseded this one
      setLoading(false);
      if (!res.ok) {
        if (!opts.silent) toast.error(apiMessage(res, "Agenda laden mislukt"));
        return;
      }
      setItems(res.data.appointments as AgendaItem[]);
    },
    [range.from, range.to]
  );

  React.useEffect(() => {
    // The server already rendered the first list window: don't fetch it twice.
    if (!usedInitial.current && range.from === initialRange.from && range.to === initialRange.to) {
      usedInitial.current = true;
      return;
    }
    usedInitial.current = true;
    void load();
  }, [load, initialRange.from, initialRange.to, range.from, range.to]);

  // Live: a colleague's change shows up within 30 s, and at once when you return to the tab.
  React.useEffect(() => {
    const tick = window.setInterval(() => document.visibilityState === "visible" && void load({ silent: true }), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load({ silent: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Keep the open detail sheet in step with fresh data.
  React.useEffect(() => {
    setSelected((cur) => (cur ? items.find((i) => i.id === cur.id) ?? cur : cur));
  }, [items]);

  // Shareable, reload-safe URL without a navigation.
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("weergave", view);
      if (view !== "lijst" && anchor !== today) url.searchParams.set("datum", anchor);
      else url.searchParams.delete("datum");
      window.history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
  }, [view, anchor, today]);

  // --- Data helpers ---------------------------------------------------------------
  const patchItem = React.useCallback((next: AgendaItem) => {
    setItems((prev) => (prev.some((i) => i.id === next.id) ? prev.map((i) => (i.id === next.id ? next : i)) : [...prev, next]));
    setSelected((cur) => (cur && cur.id === next.id ? next : cur));
  }, []);

  const visible = React.useMemo(() => applyFilters(items, filters, viewerId, nowMs), [items, filters, viewerId, nowMs]);
  const summary = React.useMemo(() => summarizeAgenda(items, viewerId, nowMs), [items, viewerId, nowMs]);
  const filtered = activeFilterCount(filters) > 0;

  async function finish(item: AgendaItem) {
    const res = await api(`/api/appointments/${item.id}/status`, "POST", { status: "DONE" });
    if (!res.ok) {
      toast.error(apiMessage(res, "Afronden mislukt"));
      return;
    }
    patchItem(res.data.appointment);
    toast.success("Afspraak afgerond", {
      action: {
        label: "Ongedaan maken",
        onClick: () => void api(`/api/appointments/${item.id}/status`, "POST", { status: "PLANNED" }).then((r) => r.ok && patchItem(r.data.appointment)),
      },
    });
  }

  async function join(item: AgendaItem) {
    const res = await api(`/api/appointments/${item.id}/assign`, "POST", { userId: viewerId });
    if (!res.ok) {
      toast.error(apiMessage(res, "Opslaan mislukt"));
      return;
    }
    patchItem(res.data.appointment);
    toast.success("Je gaat mee");
  }

  async function move(item: AgendaItem, patch: MovePatch) {
    const start = parseDatetimeLocalAsAmsterdam(patch.startAt);
    const end = patch.endAt ? parseDatetimeLocalAsAmsterdam(patch.endAt) : null;
    if (!start) return;
    const before = item;
    patchItem({ ...item, startAt: start.toISOString(), endAt: end ? end.toISOString() : null }); // optimistic
    const res = await api(`/api/appointments/${item.id}/move`, "POST", { startAt: patch.startAt, endAt: patch.endAt, allDay: false });
    if (!res.ok) {
      patchItem(before);
      toast.error(apiMessage(res, "Verplaatsen mislukt"));
      return;
    }
    patchItem(res.data.appointment);
    toast.success(`Verplaatst naar ${formatAgendaTime(res.data.appointment)}`, {
      action: {
        label: "Ongedaan maken",
        onClick: async () => {
          const r = await api(`/api/appointments/${item.id}/move`, "POST", {
            startAt: localOf(before.startAt),
            endAt: before.endAt ? localOf(before.endAt) : "",
            allDay: false,
          });
          if (r.ok) patchItem(r.data.appointment);
          else toast.error(apiMessage(r, "Ongedaan maken mislukt"));
        },
      },
    });
  }

  function openForm(next: FormState) {
    dirtyRef.current = false;
    setForm(next);
  }

  function closeForm() {
    if (dirtyRef.current && !window.confirm("Wijzigingen weggooien? Wat je hebt ingevuld is nog niet opgeslagen.")) return;
    dirtyRef.current = false;
    setForm(null);
  }

  function onSaved(result: SavedResult) {
    const editing = form?.mode === "edit";
    setForm(null);
    setSelected(null);
    if (result.appointment) patchItem(result.appointment);
    toast.success(editing ? (result.count > 1 ? `${result.count} afspraken bijgewerkt` : "Afspraak bijgewerkt") : result.count > 1 ? `${result.count} afspraken toegevoegd` : "Afspraak toegevoegd");
    if (!editing && result.appointment) {
      // Make sure the new afspraak is on screen: widen the list window or jump the calendar there.
      const day = ymdOfInstant(result.appointment.startAt);
      if (view === "lijst") {
        if (day > addDaysISO(today, listDays)) setListDays(Math.min(LIST_MAX_DAYS, Math.ceil(daysBetween(today, day) / LIST_STEP_DAYS) * LIST_STEP_DAYS));
      } else setAnchor(day);
    }
    void load({ silent: true });
  }

  function duplicate(item: AgendaItem) {
    const start = new Date(item.startAt);
    const startLocal = localOf(start.toISOString());
    setSelected(null);
    openForm({
      mode: "create",
      prefill: {
        title: item.title,
        startAt: item.allDay ? `${startLocal.slice(0, 10)}T09:00` : startLocal,
        endAt: item.allDay ? "" : item.endAt ? localOf(item.endAt) : "",
        allDay: item.allDay,
        category: item.category,
        clientId: item.clientId,
        location: item.location ?? "",
        description: item.description ?? "",
      },
    });
  }

  // --- Navigation -------------------------------------------------------------------
  function step(dir: -1 | 1) {
    if (view === "dag") setAnchor(addDaysISO(anchor, dir));
    else if (view === "week") setAnchor(addDaysISO(anchor, dir * 7));
    else if (view === "maand") {
      const [y, m] = anchor.split("-").map(Number);
      const t = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(t.toISOString().slice(0, 10));
    }
  }

  const title =
    view === "lijst"
      ? "Aankomende afspraken"
      : view === "dag"
        ? monthLabel(anchor, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
        : view === "week"
          ? `${monthLabel(mondayOf(anchor), { day: "numeric", month: "short" })} – ${monthLabel(addDaysISO(mondayOf(anchor), 6), { day: "numeric", month: "short", year: "numeric" })}`
          : monthLabel(anchor, { month: "long", year: "numeric" });

  function newAt(local?: string) {
    const m = Math.min(22 * 60, Math.ceil((new Date(nowMs).getHours() * 60 + 1) / 60) * 60);
    const hm = `${String(Math.floor(m / 60)).padStart(2, "0")}:00`;
    openForm({ mode: "create", prefill: { startAt: local ?? `${view === "lijst" || view === "maand" ? today : anchor}T${hm}` } });
  }

  // Keyboard: n nieuw · t vandaag · ←/→ vorige/volgende · l d w m weergave
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || form || selected) return;
      switch (e.key) {
        case "n":
          e.preventDefault();
          newAt();
          break;
        case "t":
          setAnchor(today);
          break;
        case "ArrowLeft":
          if (view !== "lijst") step(-1);
          break;
        case "ArrowRight":
          if (view !== "lijst") step(1);
          break;
        case "l":
          setView("lijst");
          break;
        case "d":
          setView("dag");
          break;
        case "w":
          setView("week");
          break;
        case "m":
          setView("maand");
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, selected, view, anchor, today]);

  const days = view === "dag" ? [anchor] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDaysISO(mondayOf(anchor), i)) : [];

  const legend = React.useMemo(() => {
    const map = new Map<string, { label: string; dot: string }>();
    for (const i of visible) {
      if (colorMode === "client") {
        const key = i.clientId ?? "none";
        if (!map.has(key)) map.set(key, { label: i.clientName ?? "Zonder cliënt", dot: colorForClient(i.clientId).dot });
      } else {
        const key = i.category ?? "none";
        if (!map.has(key)) map.set(key, { label: i.category ? AGENDA_CATEGORY_META[i.category].label : "Zonder soort", dot: colorForCategory(i.category).dot });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "nl")).slice(0, 12);
  }, [visible, colorMode]);

  const setFilter = <K extends keyof AgendaFilters>(key: K, value: AgendaFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
      on ? "border-rose-400/60 bg-rose-500/15 text-rose-300" : "border-border bg-surface2/60 text-slate-300 hover:text-slate-100"
    );

  const nFilters = activeFilterCount(filters);
  const toggleRow = (on: boolean, label: string, count: number, onChange: (v: boolean) => void) => (
    <Checkbox checked={on} onChange={onChange} className="min-h-10 w-full">
      <span className="flex flex-1 items-center justify-between gap-2">
        {label}
        {count > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-300">{count}</span>}
      </span>
    </Checkbox>
  );
  const iconBtn = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface2/60 text-slate-300 transition-colors hover:text-slate-100";

  return (
    <div className="flex flex-col gap-4">
      {/* One calm toolbar: where you are, what you see, find / filter, add */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-1 2xl:flex-none">
          {view !== "lijst" && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(today)}>
                Vandaag
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Vorige" onClick={() => step(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Volgende" onClick={() => step(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
          <h2 className="ml-1 min-w-0 truncate text-lg font-semibold text-slate-50 first-letter:uppercase" aria-live="polite">
            {title}
          </h2>
          {loading && <Loader2 className="ml-1 h-4 w-4 shrink-0 animate-spin text-slate-500" aria-label="Laden" />}
        </div>

        <div className="order-1 flex items-center gap-2 2xl:order-2 2xl:ml-auto">
          <Popover
            label="Filters"
            trigger={({ open, toggle, ref, id }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={id}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
                  nFilters > 0 ? "border-rose-400/60 bg-rose-500/10 text-rose-200" : "border-border bg-surface2/60 text-slate-300 hover:text-slate-100"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Filter</span>
                {nFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-semibold text-white">{nFilters}</span>}
                <ChevronDown className="hidden h-4 w-4 opacity-60 sm:block" />
              </button>
            )}
          >
            {(close) => (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  {toggleRow(filters.mine, "Mijn afspraken", 0, (v) => setFilter("mine", v))}
                  {toggleRow(filters.needsEscort, "Zonder begeleider", summary.needsEscort, (v) => setFilter("needsEscort", v))}
                  {toggleRow(filters.toFinish, "Nog af te ronden", summary.toFinish, (v) => setFilter("toFinish", v))}
                  {toggleRow(filters.showCancelled, "Geannuleerde tonen", 0, (v) => setFilter("showCancelled", v))}
                </div>
                <div className="grid gap-2 border-t border-border pt-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    Soort
                    <Select value={filters.category} onChange={(e) => setFilter("category", e.target.value as AgendaCategoryKey | "")} className="h-10 text-sm">
                      <option value="">Alle soorten</option>
                      {AGENDA_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {AGENDA_CATEGORY_META[c].label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    Cliënt
                    <Select value={filters.clientId} onChange={(e) => setFilter("clientId", e.target.value)} className="h-10 text-sm">
                      <option value="">Alle cliënten</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    Kleur op
                    <Select value={colorMode} onChange={(e) => chooseColorMode(e.target.value as ColorMode)} className="h-10 text-sm">
                      <option value="client">Cliënt</option>
                      <option value="category">Soort afspraak</option>
                    </Select>
                  </label>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <button type="button" disabled={!filtered} onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm text-slate-400 hover:text-slate-100 disabled:opacity-40">
                    Alles wissen
                  </button>
                  <Button type="button" size="sm" onClick={close}>
                    Klaar
                  </Button>
                </div>
              </div>
            )}
          </Popover>

          <Popover
            label="Meer"
            trigger={({ open, toggle, ref, id }) => (
              <button ref={ref} type="button" onClick={toggle} aria-expanded={open} aria-controls={id} aria-label="Meer opties" className={iconBtn}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
            )}
            className="w-64 p-1.5"
          >
            {() => <p className="px-3 py-2 text-sm text-slate-500">Geen extra opties.</p>}
          </Popover>

          <Button type="button" onClick={() => newAt()} className="h-10 gap-1.5 px-3.5 sm:px-4" aria-label="Nieuwe afspraak">
            <Plus className="h-5 w-5" /> <span className="hidden sm:inline">Nieuwe afspraak</span>
          </Button>
        </div>

        <Segmented<AgendaView>
          ariaLabel="Weergave"
          size="sm"
          className="order-2 w-full sm:ml-auto sm:w-auto 2xl:order-3 2xl:ml-0 [&>button]:flex-1"
          value={view}
          onChange={setView}
          options={[
            { value: "dag", label: "Dag" },
            { value: "week", label: "Week" },
            { value: "maand", label: "Maand" },
            { value: "lijst", label: "Lijst" },
          ]}
        />
      </div>

      {nFilters > 0 ? (
        <p className="-mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400" aria-live="polite">
          {visible.length} {visible.length === 1 ? "afspraak" : "afspraken"} getoond
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-0.5 text-xs text-slate-300 hover:text-slate-100">
            <X className="h-3 w-3" /> Filters wissen
          </button>
        </p>
      ) : summary.today > 0 || summary.ongoing > 0 ? (
        <p className="-mt-1 text-sm text-slate-400">
          Vandaag {summary.today} {summary.today === 1 ? "afspraak" : "afspraken"}
          {summary.ongoing > 0 && <span className="text-rose-300"> · {summary.ongoing} nu bezig</span>}
          {summary.needsEscort > 0 && <span className="text-amber-400"> · {summary.needsEscort} zonder begeleider</span>}
        </p>
      ) : null}

      {/* Phone: week strip above the day view */}
      {view === "dag" && (
        <div className="grid grid-cols-7 gap-1 md:hidden">
          {Array.from({ length: 7 }, (_, i) => addDaysISO(mondayOf(anchor), i)).map((d) => {
            const has = items.some((i) => i.status !== "CANCELLED" && ymdOfInstant(i.startAt) === d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setAnchor(d)}
                aria-current={d === anchor ? "date" : undefined}
                className={cn("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs transition-colors", d === anchor ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:bg-surface2")}
              >
                <span className="uppercase">{WEEKDAY_SHORT[weekdayOfISO(d)]}</span>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", d === today && "bg-rose-500 text-white")}>{Number(d.slice(8))}</span>
                <span className={cn("h-1 w-1 rounded-full", has ? "bg-rose-400" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      )}

      {view === "lijst" && (
        <AgendaList
          items={visible}
          nowMs={nowMs}
          colorMode={colorMode}
          viewerId={viewerId}
          filtered={filtered}
          hasMore={listDays < LIST_MAX_DAYS}
          loadingMore={loading}
          onLoadMore={() => setListDays((d) => Math.min(LIST_MAX_DAYS, d + LIST_STEP_DAYS))}
          onClearFilters={() => setFilters(EMPTY_FILTERS)}
          onNew={() => newAt()}
          onOpen={setSelected}
          onFinish={(i) => void finish(i)}
          onJoin={(i) => void join(i)}
        />
      )}

      {(view === "dag" || view === "week") && (
        <AgendaGrid
          days={days}
          items={visible}
          nowMs={nowMs}
          todayYmd={today}
          colorMode={colorMode}
          hideHeadersOnPhone={view === "dag" && isPhone}
          onOpen={setSelected}
          onCreateAt={(local) => openForm({ mode: "create", prefill: { startAt: local } })}
          onMove={(item, patch) => void move(item, patch)}
          onPickDay={(d) => {
            setAnchor(d);
            setView("dag");
          }}
        />
      )}

      {view === "maand" && (
        <AgendaMonth
          anchor={anchor}
          todayYmd={today}
          items={visible}
          colorMode={colorMode}
          onPickDay={(d) => {
            setAnchor(d);
            setView("dag");
          }}
          onOpen={setSelected}
        />
      )}

      {view !== "lijst" && legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-500" aria-label="Kleuren">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.dot }} /> {l.label}
            </span>
          ))}
        </div>
      )}

      {items.length === 0 && !loading && view !== "lijst" && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4" /> Geen afspraken in deze periode.
        </p>
      )}

      <AppointmentSheet
        item={selected}
        colorMode={colorMode}
        onClose={() => setSelected(null)}
        onPatched={patchItem}
        onReload={() => void load({ silent: true })}
        onRemoved={() => {
          setSelected(null);
          void load({ silent: true });
        }}
        onEdit={(item) => {
          setSelected(null);
          openForm({ mode: "edit", item });
        }}
        onDuplicate={duplicate}
      />

      <Modal open={form !== null} onClose={closeForm} title={form?.mode === "edit" ? "Afspraak bewerken" : "Nieuwe afspraak"} className="sm:max-w-2xl">
        {form && form.mode === "create" && !form.prefill.title && (
          <div className="mb-5 flex flex-col gap-1 border-b border-border pb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Snel toevoegen</p>
            <QuickAdd
              inputRef={quickRef}
              onCreated={(created) => {
                setForm(null);
                if (created) {
                  patchItem(created);
                  setAnchor(ymdOfInstant(created.startAt));
                }
                void load({ silent: true });
              }}
              onMore={(prefill) => openForm({ mode: "create", prefill })}
            />
            <p className="mt-3 text-xs text-slate-500">Of vul hieronder alles zelf in.</p>
          </div>
        )}
        {form && (
          <AppointmentForm
            key={form.mode === "edit" ? form.item.id : `new-${form.prefill.title ?? ""}-${form.prefill.startAt ?? ""}`}
            appointment={form.mode === "edit" ? form.item : undefined}
            prefill={form.mode === "create" ? form.prefill : undefined}
            onDirty={(d) => {
              dirtyRef.current = d;
            }}
            onSaved={onSaved}
            onCancel={closeForm}
          />
        )}
      </Modal>
    </div>
  );
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
}

/** "YYYY-MM-DDTHH:mm" in Amsterdam for an ISO instant (what the move/create endpoints take). */
const localOf = (iso: string) => toDatetimeLocalValue(new Date(iso));
