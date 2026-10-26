"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckSquare, RefreshCw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { comparePresence, summarizePresence, returnState, type PresenceEntry, type PresenceStatusKey } from "@/lib/presence-shared";
import { PresenceCard } from "./presence-card";
import { StatusSheet, type SheetInitial, type SheetValue } from "./status-sheet";
import { HistorySheet } from "./history-sheet";
import { formatClock, isTypingTarget } from "./presence-ui";

type Filter = "all" | "present" | "away" | "attention" | "unregistered";
type SheetTarget = { kind: "single"; clientId: string } | { kind: "bulk" } | null;

const POLL_MS = 20_000;
const TICK_MS = 30_000;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Iedereen" },
  { key: "present", label: "In huis" },
  { key: "away", label: "Afwezig" },
  { key: "attention", label: "Aandacht" },
  { key: "unregistered", label: "Niet geregistreerd" },
];

type ChangeInput = { clientId: string; status: PresenceStatusKey; expectedReturnAt: string | null; comment: string };

export function PresenceBoard({ initialEntries, serverNow }: { initialEntries: PresenceEntry[]; serverNow: number }) {
  const [entries, setEntries] = React.useState(initialEntries);
  const [now, setNow] = React.useState(serverNow);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [sheet, setSheet] = React.useState<SheetTarget>(null);
  const [historyId, setHistoryId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState(serverNow);
  const [announcement, setAnnouncement] = React.useState("");
  const pending = React.useRef(new Set<string>());
  const [, forcePending] = React.useReducer((n: number) => n + 1, 0);

  const byId = React.useMemo(() => new Map(entries.map((e) => [e.clientId, e])), [entries]);
  const summary = React.useMemo(() => summarizePresence(entries, now), [entries, now]);

  // --- Live data ------------------------------------------------------------

  const refresh = React.useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/presence", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data: { entries: PresenceEntry[] } = await res.json();
      // Never overwrite a row we are in the middle of saving.
      setEntries((prev) => {
        const mine = new Map(prev.map((e) => [e.clientId, e]));
        return data.entries.map((e) => (pending.current.has(e.clientId) ? (mine.get(e.clientId) ?? e) : e));
      });
      setLastSync(Date.now());
    } catch {
      if (manual) toast.error("Vernieuwen mislukt");
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), TICK_MS);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && selecting) {
        setSelecting(false);
        setSelected(new Set());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  // --- Saving ---------------------------------------------------------------

  function patchEntry(clientId: string, next: PresenceEntry) {
    setEntries((prev) => prev.map((e) => (e.clientId === clientId ? next : e)));
  }

  function setPending(clientId: string, on: boolean) {
    if (on) pending.current.add(clientId);
    else pending.current.delete(clientId);
    forcePending();
  }

  /** Optimistic single change with conflict handling and undo. Resolves true when saved. */
  const change = React.useCallback(
    async (input: ChangeInput, opts: { force?: boolean; silent?: boolean } = {}): Promise<boolean> => {
      const before = byId.get(input.clientId);
      if (!before) return false;
      setPending(input.clientId, true);
      const optimistic: PresenceEntry = {
        ...before,
        status: input.status,
        expectedReturnAt: input.status === "AANWEZIG" || input.status === "VERMIST" ? null : input.expectedReturnAt,
        comment: input.comment,
        changedAt: new Date().toISOString(),
        changedByName: "jij",
      };
      patchEntry(input.clientId, optimistic);
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, since: before.version, force: opts.force }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.current) {
          patchEntry(input.clientId, data.current);
          toast.warning(data.error || "Een collega was je voor", {
            duration: 10_000,
            action: { label: "Toch overnemen", onClick: () => void change(input, { force: true }) },
          });
          return false;
        }
        if (!res.ok) throw new Error(data.error || "Opslaan mislukt");
        patchEntry(input.clientId, data.entry);
        setAnnouncement(`${before.name}: ${input.status === "AANWEZIG" ? "aanwezig" : "afwezig"} opgeslagen`);
        if (!opts.silent) {
          toast.success(input.status === "VERMIST" ? "Vermist gemeld — collega's zijn gewaarschuwd" : "Opgeslagen", {
            duration: 6000,
            action: before.status
              ? {
                  label: "Ongedaan maken",
                  onClick: () =>
                    void change(
                      { clientId: before.clientId, status: before.status as PresenceStatusKey, expectedReturnAt: before.expectedReturnAt, comment: before.comment },
                      { force: true, silent: true }
                    ).then((ok) => ok && toast.success("Teruggedraaid")),
                }
              : undefined,
          });
        }
        return true;
      } catch (error) {
        patchEntry(input.clientId, before);
        toast.error(error instanceof Error ? error.message : "Opslaan mislukt, probeer opnieuw");
        return false;
      } finally {
        setPending(input.clientId, false);
      }
    },
    [byId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function submitSheet(value: SheetValue) {
    if (!sheet) return;
    setSaving(true);
    try {
      if (sheet.kind === "single") {
        const ok = await change({ clientId: sheet.clientId, ...value });
        if (ok) setSheet(null);
        return;
      }
      const ids = [...selected];
      const res = await fetch("/api/presence/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: ids, status: value.status, expectedReturnAt: value.expectedReturnAt, comment: value.comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Opslaan mislukt");
        return;
      }
      const updated = new Map<string, PresenceEntry>((data.entries as PresenceEntry[]).map((e) => [e.clientId, e]));
      setEntries((prev) => prev.map((e) => updated.get(e.clientId) ?? e));
      toast.success(`${updated.size} cliënt${updated.size === 1 ? "" : "en"} bijgewerkt`);
      if (data.failed?.length) toast.error(`${data.failed.length} niet bijgewerkt`);
      setAnnouncement(`${updated.size} cliënten bijgewerkt`);
      setSheet(null);
      setSelecting(false);
      setSelected(new Set());
    } catch {
      toast.error("Opslaan mislukt, probeer opnieuw");
    } finally {
      setSaving(false);
    }
  }

  // --- View -----------------------------------------------------------------

  const visible = React.useMemo(() => {
    return entries
      .filter((e) => {
        switch (filter) {
          case "present":
            return e.status === "AANWEZIG";
          case "away":
            return e.status !== null && e.status !== "AANWEZIG";
          case "attention":
            return e.status === "VERMIST" || returnState(e, now) === "overdue";
          case "unregistered":
            return e.status === null;
          default:
            return true;
        }
      })
      .sort((a, b) => comparePresence(a, b, now));
  }, [entries, filter, now]);

  const missing = entries.filter((e) => e.status === "VERMIST");
  const counts: Record<Filter, number> = {
    all: summary.total,
    present: summary.present,
    away: summary.absent + summary.missing,
    attention: summary.missing + summary.overdue,
    unregistered: summary.unregistered,
  };
  const sheetEntry = sheet?.kind === "single" ? byId.get(sheet.clientId) : undefined;
  const sheetInitial = React.useMemo<SheetInitial>(
    () =>
      sheetEntry
        ? { status: sheetEntry.status && sheetEntry.status !== "AANWEZIG" ? sheetEntry.status : null, expectedReturnAt: sheetEntry.expectedReturnAt, comment: sheetEntry.comment }
        : { status: null, expectedReturnAt: null, comment: "" },
    [sheetEntry]
  );
  const historyEntry = historyId ? byId.get(historyId) : undefined;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {missing.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-500/60 bg-red-500/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-50">
              {missing.length === 1 ? "1 cliënt is vermist gemeld" : `${missing.length} cliënten zijn vermist gemeld`}
            </p>
            <p className="truncate text-sm text-slate-300">{missing.map((m) => m.name).join(", ")}</p>
          </div>
        </div>
      )}

      {/* Summary tiles double as filters. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Samenvatting">
        <Tile label="In huis" value={`${summary.present}`} sub={`van ${summary.total}`} tone="ok" active={filter === "present"} onClick={() => setFilter(filter === "present" ? "all" : "present")}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
            <div className="h-full rounded-full bg-forest-500 transition-[width] duration-300 ease-out" style={{ width: `${summary.total ? (summary.present / summary.total) * 100 : 0}%` }} />
          </div>
        </Tile>
        <Tile label="Afwezig" value={`${summary.absent + summary.missing}`} sub={summary.missing ? `${summary.missing} vermist` : "gepland"} tone={summary.missing ? "alarm" : "neutral"} active={filter === "away"} onClick={() => setFilter(filter === "away" ? "all" : "away")} />
        <Tile label="Te laat terug" value={`${summary.overdue}`} sub={summary.overdue ? "even bellen?" : "niemand"} tone={summary.overdue ? "attention" : "neutral"} active={filter === "attention"} onClick={() => setFilter(filter === "attention" ? "all" : "attention")} />
        <Tile label="Niet geregistreerd" value={`${summary.unregistered}`} sub={summary.unregistered ? "nog vastleggen" : "alles bekend"} tone={summary.unregistered ? "attention" : "neutral"} active={filter === "unregistered"} onClick={() => setFilter(filter === "unregistered" ? "all" : "unregistered")} />
      </div>

      {/* Toolbar */}
      <div className="z-20 -mx-1 flex flex-col gap-2 bg-background/90 px-1 py-2 sm:sticky sm:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={selecting ? "secondary" : "outline"} size="default" aria-pressed={selecting} onClick={() => { setSelecting((v) => !v); setSelected(new Set()); }}>
            <CheckSquare className="mr-2 h-4 w-4" /> Meerdere
          </Button>
          <button
            type="button"
            onClick={() => void refresh(true)}
            aria-label="Nu vernieuwen"
            title={`Bijgewerkt om ${formatClock(lastSync)}`}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-surface2 hover:text-slate-100"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex min-h-[2.5rem] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                filter === f.key ? "border-rose-400/70 bg-rose-500/10 text-slate-50" : "border-border bg-surface2/60 text-slate-300 hover:border-slate-500/60"
              )}
            >
              {f.label}
              <span className="text-xs text-slate-500">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Users} title="Geen actieve cliënten" description="Zodra er cliënten zijn, verschijnen ze hier." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Niets gevonden"
          description="Pas het filter aan."
          action={{ label: "Filters wissen", onClick: () => setFilter("all") }}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((entry) => (
            <PresenceCard
              key={entry.clientId}
              entry={entry}
              now={now}
              pending={pending.current.has(entry.clientId)}
              selecting={selecting}
              selected={selected.has(entry.clientId)}
              onToggleSelect={() => toggleSelect(entry.clientId)}
              onQuickPresent={() => void change({ clientId: entry.clientId, status: "AANWEZIG", expectedReturnAt: null, comment: "" })}
              onOpenSheet={() => setSheet({ kind: "single", clientId: entry.clientId })}
              onOpenHistory={() => setHistoryId(entry.clientId)}
            />
          ))}
        </ul>
      )}

      {/* Bulk bar */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-medium text-slate-200" aria-live="polite">
              {selected.size} geselecteerd
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(visible.map((v) => v.clientId)))}>
              Alle {visible.length} zichtbare
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={selected.size === 0}
              loading={saving}
              onClick={() => {
                setSaving(true);
                void (async () => {
                  const res = await fetch("/api/presence/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientIds: [...selected], status: "AANWEZIG" }) });
                  const data = await res.json().catch(() => ({}));
                  setSaving(false);
                  if (!res.ok) return void toast.error(data.error || "Opslaan mislukt");
                  const updated = new Map<string, PresenceEntry>((data.entries as PresenceEntry[]).map((e) => [e.clientId, e]));
                  setEntries((prev) => prev.map((e) => updated.get(e.clientId) ?? e));
                  toast.success(`${updated.size} cliënt${updated.size === 1 ? "" : "en"} aanwezig`);
                  setSelecting(false);
                  setSelected(new Set());
                })();
              }}
            >
              Aanwezig
            </Button>
            <Button type="button" disabled={selected.size === 0} onClick={() => setSheet({ kind: "bulk" })}>
              Afwezig…
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Selectie sluiten" onClick={() => { setSelecting(false); setSelected(new Set()); }}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      <StatusSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.kind === "bulk" ? `${selected.size} cliënten afwezig melden` : sheetEntry ? `${sheetEntry.name} — status` : "Status"}
        initial={sheetInitial}
        allowMissing={sheet?.kind === "single"}
        saving={saving}
        onSubmit={submitSheet}
      />
      <HistorySheet clientId={historyId} title={historyEntry?.name ?? ""} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  active,
  onClick,
  children,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "attention" | "alarm" | "neutral";
  active: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col rounded-2xl border p-3.5 text-left transition-colors",
        active ? "border-rose-400/70 bg-rose-500/10" : "border-border bg-surface hover:border-slate-500/60",
        tone === "alarm" && !active && "border-red-500/50 bg-red-500/10"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-3xl font-semibold tabular-nums", tone === "ok" && "text-forest-300", tone === "attention" && "text-rose-300", tone === "alarm" && "text-red-300", tone === "neutral" && "text-slate-50")}>{value}</span>
        <span className="text-xs text-slate-500">{sub}</span>
      </span>
      {children}
    </button>
  );
}
