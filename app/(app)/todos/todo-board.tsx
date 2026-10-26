"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ListChecks, ListTodo, Moon, RefreshCw, Search, SlidersHorizontal, X, AlarmClock, CalendarDays, BellOff } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AnimatedListItem } from "@/components/ui/animated-list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  amsterdamNow,
  compareOverdue,
  compareTodos,
  formatDayShort,
  isLate,
  nextOccurrence,
  partOfDay,
  PART_OF_DAY_LABEL,
  relativeDayLabel,
  snoozeUntil,
  summarizeTodos,
  TODO_CATEGORIES,
  TODO_CATEGORY_META,
  todoBucket,
  type QuickAddResult,
  type TodoClientOption,
  type TodoData,
  type TodoPartOfDay,
} from "@/lib/todos-shared";
import { api, apiMessage, formatClock, isTypingTarget } from "./todo-ui";
import { TodoEnvProvider, useTodoEnv } from "./todo-env";
import { QuickAdd } from "./quick-add";
import { TodoForm, type TodoPrefill } from "./todo-form";
import { TodoItem } from "./todo-item";

/** Re-exported for the Dashboard widget, which sorts its personal list the same way. */
export const sortByTime = compareTodos;

type View = "today" | "upcoming" | "snoozed" | "done";

const POLL_MS = 20_000;
const PART_ORDER: TodoPartOfDay[] = ["late", "morning", "afternoon", "evening", "anytime"];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TodoBoard(props: {
  initialOpen: TodoData[];
  initialCompleted: TodoData[];
  /** Server clock at render time: the first client render must match the server HTML. */
  serverNow: number;
  clients: TodoClientOption[];
  viewerId: string;
  /** Admin / coordinator: may select several tasks and manage everyone's. */
  canSupervise: boolean;
}) {
  return (
    <TodoEnvProvider serverNow={props.serverNow} clients={props.clients} viewerId={props.viewerId} canSupervise={props.canSupervise}>
      <BoardInner initialOpen={props.initialOpen} initialCompleted={props.initialCompleted} serverNow={props.serverNow} />
    </TodoEnvProvider>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : done / total;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`${done} van ${total} taken afgerond vandaag`} className="shrink-0">
      <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="6" className="stroke-surface2" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform="rotate(-90 28 28)"
        className="stroke-forest-500 transition-[stroke-dashoffset] duration-500"
      />
      <text x="28" y="32" textAnchor="middle" className="fill-slate-100 text-[13px] font-semibold tabular-nums">
        {done}/{total}
      </text>
    </svg>
  );
}

function BoardInner({ initialOpen, initialCompleted, serverNow }: { initialOpen: TodoData[]; initialCompleted: TodoData[]; serverNow: number }) {
  const { viewerId, canSupervise, nowMs } = useTodoEnv();
  const now = nowMs || serverNow;
  const today = amsterdamNow(now).dateISO;

  const [open, setOpen] = React.useState(initialOpen);
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [view, setView] = React.useState<View>("today");
  const [mine, setMine] = React.useState(false);
  const [unclaimed, setUnclaimed] = React.useState(false);
  const [lateOnly, setLateOnly] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [category, setCategory] = React.useState("");
  const [clientFilter, setClientFilter] = React.useState("");
  const [formPrefill, setFormPrefill] = React.useState<TodoPrefill | null>(null);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState(serverNow);
  const [announcement, setAnnouncement] = React.useState("");
  // Rows stay in their list through their own exit animation (see AnimatedListItem);
  // completingPayload remembers the just-completed task for the open -> done move.
  const [exitingOpenIds, setExitingOpenIds] = React.useState<Set<string>>(new Set());
  const [exitingCompletedIds, setExitingCompletedIds] = React.useState<Set<string>>(new Set());
  const completingPayload = React.useRef<Record<string, TodoData>>({});
  const quickRef = React.useRef<HTMLInputElement>(null);
  const epoch = React.useRef(0); // bumped on every local change so a slow poll can't undo it
  const exitingCount = React.useRef(0);
  exitingCount.current = exitingOpenIds.size + exitingCompletedIds.size;
  const { clients } = useTodoEnv();

  const mutated = () => {
    epoch.current++;
  };

  // --- Live data ------------------------------------------------------------

  const refresh = React.useCallback(async (manual = false) => {
    if (exitingCount.current > 0) return;
    const startedAt = epoch.current;
    if (manual) setRefreshing(true);
    const res = await api("/api/todos", "GET");
    if (manual) setRefreshing(false);
    if (!res.ok || !res.data.open || !res.data.completed) {
      if (manual) toast.error("Vernieuwen mislukt");
      return;
    }
    if (epoch.current !== startedAt) return; // something changed locally while we were waiting
    setOpen(res.data.open);
    setCompleted(res.data.completed);
    setLastSync(Date.now());
  }, []);

  React.useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        quickRef.current?.focus();
      } else if (e.key === "Escape" && selectMode) {
        exitSelectMode();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode]);

  // --- Derived lists --------------------------------------------------------

  const visibleOpen = React.useMemo(() => open.filter((t) => todoBucket(t, now) !== "hidden"), [open, now]);
  const summary = React.useMemo(() => summarizeTodos(visibleOpen, completed, now), [visibleOpen, completed, now]);

  const filtersActive = Boolean(mine || unclaimed || lateOnly || category || clientFilter);
  const activeFilterCount = [mine, unclaimed, lateOnly, category, clientFilter].filter(Boolean).length;
  const passes = React.useCallback(
    (t: TodoData) =>
      (!mine || t.claimedById === viewerId) &&
      (!unclaimed || !t.claimedById) &&
      (!lateOnly || isLate(t, now)) &&
      (!category || t.category === category) &&
      (!clientFilter || t.clientId === clientFilter),
    [mine, unclaimed, lateOnly, category, clientFilter, viewerId, now]
  );

  const lists = React.useMemo(() => {
    const todayList: TodoData[] = [];
    const upcoming: TodoData[] = [];
    const snoozed: TodoData[] = [];
    for (const t of visibleOpen) {
      if (!passes(t)) continue;
      const b = todoBucket(t, now);
      if (b === "overdue" || b === "today") todayList.push(t);
      else if (b === "upcoming") upcoming.push(t);
      else if (b === "snoozed") snoozed.push(t);
    }
    const sections = new Map<TodoPartOfDay, TodoData[]>();
    for (const t of todayList) {
      const part = partOfDay(t, now);
      sections.set(part, [...(sections.get(part) ?? []), t]);
    }
    for (const [part, items] of sections) items.sort(part === "late" ? compareOverdue : compareTodos);

    const byDay = new Map<string, TodoData[]>();
    for (const t of upcoming) {
      const key = nextOccurrence(t, now) ?? "later";
      byDay.set(key, [...(byDay.get(key) ?? []), t]);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => (a === "later" ? 1 : b === "later" ? -1 : a.localeCompare(b)));
    for (const [, items] of days) items.sort(compareTodos);

    snoozed.sort((a, b) => (a.snoozedUntil ?? "").localeCompare(b.snoozedUntil ?? ""));
    const done = completed.filter(passes);
    return { sections, todayCount: todayList.length, days, upcomingCount: upcoming.length, snoozed, done };
  }, [visibleOpen, completed, passes, now]);

  const visibleIds = React.useMemo(() => {
    if (view === "today") return [...lists.sections.values()].flat().map((t) => t.id);
    if (view === "upcoming") return lists.days.flatMap(([, items]) => items.map((t) => t.id));
    if (view === "snoozed") return lists.snoozed.map((t) => t.id);
    return [];
  }, [view, lists]);

  // --- Mutations ------------------------------------------------------------

  function announce(message: string) {
    setAnnouncement(message);
  }

  function handleCreated(todo: TodoData) {
    mutated();
    setOpen((prev) => (prev.some((t) => t.id === todo.id) ? prev.map((t) => (t.id === todo.id ? todo : t)) : [...prev, todo]));
    setFormPrefill(null);
    announce(`Taak toegevoegd: ${todo.title}`);
    const b = todoBucket(todo, Date.now());
    if (b === "upcoming" || b === "snoozed") {
      toast.info(b === "upcoming" ? "De taak staat onder Komend." : "De taak staat onder Uitgesteld.", { action: { label: "Bekijken", onClick: () => setView(b) } });
    }
  }

  function handleUpdated(todo: TodoData) {
    mutated();
    setOpen((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
    setCompleted((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
  }

  function handleComplete(todo: TodoData) {
    mutated();
    completingPayload.current[todo.id] = todo;
    setExitingOpenIds((prev) => new Set(prev).add(todo.id));
    announce(`Afgerond: ${todo.title}`);
  }

  function handleUncomplete(todo: TodoData) {
    mutated();
    setCompleted((prev) => prev.filter((t) => t.id !== todo.id));
    setOpen((prev) => (prev.some((t) => t.id === todo.id) ? prev : [...prev, todo]));
    announce(`Heropend: ${todo.title}`);
  }

  function handleDelete(id: string) {
    mutated();
    if (open.some((t) => t.id === id)) setExitingOpenIds((prev) => new Set(prev).add(id));
    if (completed.some((t) => t.id === id)) setExitingCompletedIds((prev) => new Set(prev).add(id));
  }

  function finishOpenExit(id: string) {
    setExitingOpenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setOpen((prev) => prev.filter((t) => t.id !== id));
    const payload = completingPayload.current[id];
    if (payload) {
      delete completingPayload.current[id];
      setCompleted((prev) => [payload, ...prev.filter((t) => t.id !== id)]);
    }
  }

  function finishCompletedExit(id: string) {
    setExitingCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setCompleted((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function bulk(action: "complete" | "snooze") {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    const res = await api("/api/todos/bulk", "POST", action === "complete" ? { action, ids } : { action, ids, until: snoozeUntil("tomorrow", Date.now()) });
    setBulkBusy(false);
    if (!res.ok) {
      toast.error(apiMessage(res, action === "complete" ? "Afronden mislukt" : "Uitstellen mislukt"));
      return;
    }
    mutated();
    const changed = new Set(res.data.ids ?? []);
    if (action === "complete") {
      const nowDone = open.filter((t) => changed.has(t.id)).map((t) => ({ ...t, completed: true, completedAt: new Date().toISOString(), completedByName: "Jij" }));
      setOpen((prev) => prev.filter((t) => !changed.has(t.id)));
      setCompleted((prev) => [...nowDone, ...prev]);
      toast.success(changed.size === 1 ? "Taak afgerond" : `${changed.size} taken afgerond`);
    } else {
      const until = snoozeUntil("tomorrow", Date.now());
      setOpen((prev) => prev.map((t) => (changed.has(t.id) ? { ...t, snoozedUntil: until } : t)));
      toast.success(changed.size === 1 ? "Taak uitgesteld tot morgen" : `${changed.size} taken uitgesteld tot morgen`);
    }
    exitSelectMode();
  }

  function resetFilters() {
    setMine(false);
    setUnclaimed(false);
    setLateOnly(false);
    setCategory("");
    setClientFilter("");
  }

  function moreFromQuickAdd(parsed: QuickAddResult) {
    setFormPrefill({
      title: parsed.title,
      time: parsed.time ?? undefined,
      dueDate: parsed.dueDate ?? undefined,
      priority: parsed.priority ?? undefined,
      category: parsed.category,
      clientId: parsed.clientId,
    });
  }

  // --- Rendering ------------------------------------------------------------

  function row(t: TodoData, completedList = false) {
    return (
      <AnimatedListItem
        key={t.id}
        exiting={(completedList ? exitingCompletedIds : exitingOpenIds).has(t.id)}
        onExited={() => (completedList ? finishCompletedExit(t.id) : finishOpenExit(t.id))}
      >
        <TodoItem
          todo={t}
          canManage={canSupervise || t.createdById === viewerId}
          onComplete={handleComplete}
          onUncomplete={handleUncomplete}
          onUpdate={handleUpdated}
          onDelete={handleDelete}
          selectable={selectMode && !completedList}
          selected={selectedIds.has(t.id)}
          onToggleSelect={() => toggleSelected(t.id)}
        />
      </AnimatedListItem>
    );
  }

  const tabs: { key: View; label: string; count: number; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "today", label: "Vandaag", count: lists.todayCount, icon: ListTodo },
    { key: "upcoming", label: "Komend", count: lists.upcomingCount, icon: CalendarDays },
    { key: "snoozed", label: "Uitgesteld", count: lists.snoozed.length, icon: BellOff },
    { key: "done", label: "Afgerond", count: lists.done.length, icon: CheckCircle2 },
  ];

  const totalToday = summary.doneToday + summary.openToday;
  const hasClients = clients.length > 0;

  function heading(text: string, count: number, tone?: "late") {
    return (
      <h3 className={cn("mb-2 mt-1 flex items-baseline gap-2 text-sm font-semibold", tone === "late" ? "text-red-300" : "text-slate-400")}>
        {tone === "late" && <AlarmClock className="h-4 w-4 self-center" aria-hidden="true" />}
        {text}
        <span className="text-xs font-normal tabular-nums text-slate-500">{count}</span>
      </h3>
    );
  }

  function emptyState() {
    if (filtersActive) {
      return <EmptyState icon={Search} title="Geen taken gevonden" description="Haal een filter weg om meer taken te zien." action={{ label: "Filters wissen", onClick: resetFilters }} />;
    }
    if (view === "today") {
      return summary.doneToday > 0 ? (
        <EmptyState icon={CheckCircle2} title="Alles gedaan voor vandaag" description={`${summary.doneToday} ${summary.doneToday === 1 ? "taak" : "taken"} afgerond. Mooi werk.`} />
      ) : (
        <EmptyState icon={ListTodo} title="Geen taken voor vandaag" description="Voeg hierboven een taak toe, of bekijk wat er komt." action={{ label: "Taak toevoegen", onClick: () => quickRef.current?.focus() }} />
      );
    }
    if (view === "upcoming") return <EmptyState icon={CalendarDays} title="Niets gepland voor de komende dagen" />;
    if (view === "snoozed") return <EmptyState icon={Moon} title="Niets uitgesteld" description="Een taak die je uitstelt, komt hier te staan tot het tijdstip dat je koos." />;
    return <EmptyState icon={CheckCircle2} title="Nog niets afgerond" description="Afgeronde taken blijven hier een week zichtbaar." />;
  }

  const viewIsEmpty =
    (view === "today" && lists.todayCount === 0) || (view === "upcoming" && lists.upcomingCount === 0) || (view === "snoozed" && lists.snoozed.length === 0) || (view === "done" && lists.done.length === 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 sm:gap-4 sm:p-4">
          <ProgressRing done={summary.doneToday} total={totalToday} />
          <div className="min-w-0">
            <div className="font-semibold text-slate-100">{summary.openToday === 0 ? (summary.doneToday > 0 ? "Alles gedaan" : "Niets te doen") : `${summary.openToday} nog te doen`}</div>
            <div className="text-xs text-slate-500">{summary.doneToday} vandaag afgerond</div>
          </div>
        </div>
        {summary.late > 0 ? (
          <button
            type="button"
            onClick={() => {
              setView("today");
              setLateOnly((v) => !v);
            }}
            aria-pressed={lateOnly}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 sm:gap-3 sm:p-4",
              lateOnly ? "border-red-500 bg-red-500/20" : "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
            )}
          >
            <AlarmClock className="h-5 w-5 shrink-0 text-red-300 sm:h-6 sm:w-6" />
            <span>
              <span className="block font-semibold text-red-200">{summary.late === 1 ? "1 te laat" : `${summary.late} te laat`}</span>
              <span className="hidden text-xs text-red-300/80 sm:block">{lateOnly ? "Tik om alles te tonen" : "Tik om alleen deze te tonen"}</span>
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-3 text-sm text-slate-400 sm:gap-3 sm:p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-forest-400" /> Niets is te laat.
          </div>
        )}
      </div>

      <QuickAdd inputRef={quickRef} onCreated={handleCreated} onMore={moreFromQuickAdd} />

      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Weergave" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface2 p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(t.key)}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[13px] font-medium sm:gap-1.5 sm:px-3 sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
                  active ? "bg-surface text-slate-50 shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Icon className="hidden h-4 w-4 sm:block" /> {t.label}
                <span className={cn("rounded-full px-1 text-xs tabular-nums sm:px-1.5", active ? "bg-rose-500/20 text-rose-300" : "text-slate-500 sm:bg-surface")}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)} className={cn(filterChip(filtersOpen || activeFilterCount > 0), "gap-1.5")}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && <span className="rounded-full bg-rose-500/25 px-1.5 text-xs tabular-nums">{activeFilterCount}</span>}
          </button>
          <div className="ml-auto flex items-center gap-2">
            {canSupervise && view !== "done" && !selectMode && (
              <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
                <ListChecks className="h-4 w-4" /> Selecteren
              </Button>
            )}
            <button
              type="button"
              onClick={() => void refresh(true)}
              aria-label="Nu vernieuwen"
              title={`Bijgewerkt om ${formatClock(lastSync)}. Tik om te vernieuwen.`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-200"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> <span className="hidden sm:inline">{formatClock(lastSync)}</span>
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface2/30 p-3">
            <button type="button" aria-pressed={mine} onClick={() => setMine((v) => !v)} className={filterChip(mine)}>
              Door mij opgepakt
            </button>
            <button type="button" aria-pressed={unclaimed} onClick={() => setUnclaimed((v) => !v)} className={filterChip(unclaimed)}>
              Nog niemand
            </button>
            <Select aria-label="Categorie" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-auto min-w-[9rem]">
              <option value="">Alle categorieën</option>
              {TODO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TODO_CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
            {hasClients && (
              <Select aria-label="Cliënt" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="h-10 w-auto min-w-[9rem]">
                <option value="">Alle cliënten</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-slate-400 hover:text-slate-100">
                <X className="h-4 w-4" /> Wissen
              </button>
            )}
          </div>
        )}

        {selectMode && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3" role="region" aria-label="Selectie">
            <span className="text-sm text-rose-200">{selectedIds.size === 1 ? "1 taak geselecteerd" : `${selectedIds.size} taken geselecteerd`}</span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(selectedIds.size === visibleIds.length ? new Set() : new Set(visibleIds))}>
              {selectedIds.size === visibleIds.length && visibleIds.length > 0 ? "Niets selecteren" : "Alles selecteren"}
            </Button>
            <Button size="sm" variant="secondary" loading={bulkBusy} disabled={selectedIds.size === 0} onClick={() => void bulk("complete")}>
              Afronden
            </Button>
            <Button size="sm" variant="outline" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => void bulk("snooze")}>
              Uitstellen tot morgen
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectMode}>
              <X className="h-4 w-4" /> Annuleren
            </Button>
          </div>
        )}
      </div>

      <div role="tabpanel" className="flex flex-col gap-1">
        {viewIsEmpty ? (
          emptyState()
        ) : view === "today" ? (
          PART_ORDER.filter((p) => lists.sections.has(p)).map((part) => {
            const items = lists.sections.get(part)!;
            return (
              <section key={part} aria-label={PART_OF_DAY_LABEL[part]} className="mb-3">
                {heading(PART_OF_DAY_LABEL[part], items.length, part === "late" ? "late" : undefined)}
                <div className="flex flex-col gap-2.5">{items.map((t) => row(t))}</div>
              </section>
            );
          })
        ) : view === "upcoming" ? (
          lists.days.map(([key, items]) => (
            <section key={key} className="mb-3">
              {heading(key === "later" ? "Later" : `${capitalize(relativeDayLabel(key, today))} · ${formatDayShort(key)}`, items.length)}
              <div className="flex flex-col gap-2.5">{items.map((t) => row(t))}</div>
            </section>
          ))
        ) : view === "snoozed" ? (
          <div className="flex flex-col gap-2.5">{lists.snoozed.map((t) => row(t))}</div>
        ) : (
          <DoneList tasks={lists.done} today={today} render={(t) => row(t, true)} />
        )}
      </div>

      <Modal open={formPrefill !== null} onClose={() => setFormPrefill(null)} title="Nieuwe taak" className="sm:max-w-2xl">
        {formPrefill && <TodoForm prefill={formPrefill} onSaved={handleCreated} onCancel={() => setFormPrefill(null)} />}
      </Modal>
    </div>
  );
}

function filterChip(active: boolean): string {
  return cn(
    "inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
    active ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-border bg-surface2 text-slate-300 hover:bg-surface2/70"
  );
}

function DoneList({ tasks, today, render }: { tasks: TodoData[]; today: string; render: (t: TodoData) => React.ReactNode }) {
  const [showAll, setShowAll] = React.useState(false);
  const shown = showAll ? tasks : tasks.slice(0, 25);
  const groups = new Map<string, TodoData[]>();
  for (const t of shown) {
    const day = t.completedAt ? amsterdamNow(new Date(t.completedAt).getTime()).dateISO : "onbekend";
    groups.set(day, [...(groups.get(day) ?? []), t]);
  }
  return (
    <>
      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="mb-3">
          <h3 className="mb-2 mt-1 text-sm font-semibold text-slate-400">{day === "onbekend" ? "Eerder" : `${capitalize(relativeDayLabel(day, today))} · ${formatDayShort(day)}`}</h3>
          <div className="flex flex-col gap-2.5">{items.map(render)}</div>
        </section>
      ))}
      {!showAll && tasks.length > shown.length && (
        <button type="button" onClick={() => setShowAll(true)} className="flex items-center gap-1.5 self-start text-sm font-medium text-slate-400 hover:text-slate-200">
          <ChevronDown className="h-4 w-4" /> Toon alle {tasks.length}
        </button>
      )}
    </>
  );
}
