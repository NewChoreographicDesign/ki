"use client";

import * as React from "react";
import { CalendarDays, Check, Repeat, SearchX, UserCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SwipeRow } from "@/components/ui/swipe-row";
import { cn } from "@/lib/utils";
import {
  agendaState,
  AGENDA_CATEGORY_META,
  compareAgenda,
  fmtHM,
  groupByDay,
  minutesOfInstant,
  needsEscort,
  startMs,
  ymdOfInstant,
  type AgendaItem,
} from "@/lib/agenda-shared";
import { amsterdamNow } from "@/lib/date-shared";
import { CATEGORY_ICON, colorOf, initials, whenPhrase, type ColorMode } from "./agenda-ui";

type Handlers = {
  onOpen: (item: AgendaItem) => void;
  onFinish: (item: AgendaItem) => void;
  onJoin: (item: AgendaItem) => void;
};

function AgendaCard({ item, nowMs, colorMode, viewerId, onOpen, onFinish, onJoin }: Handlers & { item: AgendaItem; nowMs: number; colorMode: ColorMode; viewerId: string }) {
  const state = agendaState(item, nowMs);
  const color = colorOf(item, colorMode);
  const Icon = item.category ? CATEGORY_ICON[item.category] : null;
  const phrase = whenPhrase(item, nowMs);
  const escort = needsEscort(item, nowMs);
  const dim = state === "cancelled" || state === "done";
  const endsOtherDay = item.endAt && ymdOfInstant(item.endAt) !== ymdOfInstant(item.startAt);

  const card = (
    <article
      className={cn(
        "flex items-stretch overflow-hidden rounded-2xl border bg-surface transition-colors",
        state === "ongoing" ? "border-rose-400/50 shadow-glow-rose" : "border-border",
        dim && "opacity-70"
      )}
      style={{ borderLeft: `4px solid ${color.border}` }}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 p-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 sm:p-4"
        aria-label={`${item.title}, ${item.allDay ? "hele dag" : fmtHM(minutesOfInstant(item.startAt))}${item.clientName ? `, ${item.clientName}` : ""}. Open details`}
      >
        <div className="w-14 shrink-0 text-center tabular-nums">
          {item.allDay ? (
            <span className="text-xs font-semibold uppercase leading-tight text-slate-300">Hele dag</span>
          ) : (
            <>
              <span className="block text-base font-semibold text-slate-50">{fmtHM(minutesOfInstant(item.startAt))}</span>
              {item.endAt && <span className="block text-xs text-slate-500">{endsOtherDay ? "→" : fmtHM(minutesOfInstant(item.endAt))}</span>}
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn("truncate text-[15px] font-medium text-slate-50", state === "cancelled" && "line-through decoration-slate-500")}>{item.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            {item.clientName && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3 w-3" /> {item.clientName}
              </span>
            )}
            {Icon && item.category && (
              <span className="inline-flex items-center gap-1">
                <Icon className="h-3 w-3" /> {AGENDA_CATEGORY_META[item.category].label}
              </span>
            )}
            {item.location && <span className="truncate">{item.location}</span>}
            {item.seriesId && <Repeat className="h-3 w-3" aria-label="Onderdeel van een reeks" />}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {state === "ongoing" && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">Nu bezig</span>}
            {state === "upcoming" && phrase && <span className="text-xs text-slate-500">{phrase}</span>}
            {state === "done" && <span className="rounded-full bg-forest-500/15 px-2 py-0.5 text-xs font-medium text-forest-300">Afgerond</span>}
            {state === "cancelled" && <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300">Geannuleerd</span>}
            {state === "to-finish" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">Nog af te ronden</span>}
            {item.assigneeName && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[9px] font-semibold text-rose-300">{initials(item.assigneeName)}</span>
                {item.assigneeId === viewerId ? "Jij gaat mee" : item.assigneeName}
              </span>
            )}
            {escort && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">Nog niemand gaat mee</span>}
          </span>
        </div>
      </button>
      {item.status === "PLANNED" && (
        <div className="flex shrink-0 flex-col items-end justify-center gap-1 pr-2">
          {!item.assigneeId && (
            <Button type="button" size="sm" variant="outline" aria-label={`Ik ga mee naar ${item.title}`} title="Ik ga mee" onClick={() => onJoin(item)} className="gap-1.5 px-2.5">
              <UserCheck className="h-4 w-4" /> <span className="hidden sm:inline">Ik ga mee</span>
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" aria-label={`${item.title} afronden`} title="Afronden" onClick={() => onFinish(item)}>
            <Check className="h-5 w-5 text-forest-400" />
          </Button>
        </div>
      )}
    </article>
  );

  return item.status === "PLANNED" ? (
    <SwipeRow actions={[{ label: "Afronden", icon: Check, onTrigger: () => onFinish(item) }]}>{card}</SwipeRow>
  ) : (
    card
  );
}

/**
 * The list view: what still needs closing, then the coming days with a "nu"
 * marker in today. Cards open the detail sheet; the two buttons on a planned
 * card ("Ik ga mee", "Afronden") and the swipe cover the everyday actions
 * without opening anything.
 */
export function AgendaList({
  items,
  nowMs,
  colorMode,
  viewerId,
  filtered,
  hasMore,
  loadingMore,
  onLoadMore,
  onClearFilters,
  onNew,
  ...handlers
}: Handlers & {
  items: AgendaItem[];
  nowMs: number;
  colorMode: ColorMode;
  viewerId: string;
  /** Items were hidden by a search or filter. */
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClearFilters: () => void;
  onNew: () => void;
}) {
  const today = amsterdamNow(nowMs).dateISO;
  const toFinish = React.useMemo(() => items.filter((i) => agendaState(i, nowMs) === "to-finish").sort((a, b) => compareAgenda(b, a)), [items, nowMs]);
  const upcoming = React.useMemo(() => items.filter((i) => agendaState(i, nowMs) !== "to-finish"), [items, nowMs]);
  const days = React.useMemo(() => groupByDay(upcoming, today, today), [upcoming, today]);
  const todayHasItems = days.some((d) => d.ymd === today);

  if (items.length === 0) {
    return filtered ? (
      <EmptyState icon={SearchX} title="Geen afspraken gevonden" description="Haal een filter weg om meer afspraken te zien." action={{ label: "Filters wissen", onClick: onClearFilters }} />
    ) : (
      <EmptyState icon={CalendarDays} title="Geen aankomende afspraken" description="Voeg een afspraak toe met de balk hierboven, bijvoorbeeld: morgen 14:00 tandarts @els" action={{ label: "Nieuwe afspraak", onClick: onNew }} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {toFinish.length > 0 && (
        <section aria-labelledby="agenda-tofinish" className="flex flex-col gap-2">
          <h2 id="agenda-tofinish" className="text-sm font-semibold text-amber-400">
            Nog af te ronden ({toFinish.length})
          </h2>
          <p className="-mt-1 text-xs text-slate-500">Deze afspraken zijn geweest. Rond ze af (met eventueel de uitslag) of annuleer ze.</p>
          {toFinish.map((item) => (
            <AgendaCard key={item.id} item={item} nowMs={nowMs} colorMode={colorMode} viewerId={viewerId} {...handlers} />
          ))}
        </section>
      )}

      {!todayHasItems && !filtered && (
        <section aria-label="Vandaag">
          <h2 className="mb-2 text-sm font-semibold text-rose-300">Vandaag</h2>
          <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-slate-500">Geen (resterende) afspraken vandaag.</p>
        </section>
      )}

      {days.map((day) => {
        const isToday = day.ymd === today;
        const nowIndex = isToday ? day.items.findIndex((i) => !i.allDay && startMs(i) > nowMs) : -1;
        return (
          <section key={day.ymd} aria-labelledby={`agenda-day-${day.ymd}`} className="flex flex-col gap-2">
            <h2 id={`agenda-day-${day.ymd}`} className={cn("text-sm font-semibold first-letter:uppercase", isToday ? "text-rose-300" : "text-slate-300")}>
              {day.label}
              <span className="ml-2 text-xs font-normal normal-case text-slate-500">{day.items.length} {day.items.length === 1 ? "afspraak" : "afspraken"}</span>
            </h2>
            {day.items.map((item, index) => (
              <React.Fragment key={`${day.ymd}-${item.id}`}>
                {isToday && index === nowIndex && <NowMarker nowMs={nowMs} />}
                <AgendaCard item={item} nowMs={nowMs} colorMode={colorMode} viewerId={viewerId} {...handlers} />
              </React.Fragment>
            ))}
            {isToday && nowIndex === -1 && day.items.some((i) => !i.allDay) && <NowMarker nowMs={nowMs} />}
          </section>
        );
      })}

      {hasMore && (
        <Button type="button" variant="outline" loading={loadingMore} onClick={onLoadMore} className="self-center">
          Toon 2 weken extra
        </Button>
      )}
    </div>
  );
}

function NowMarker({ nowMs }: { nowMs: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-rose-300" role="separator" aria-label="Nu">
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      <span className="tabular-nums">{fmtHM(minutesOfInstant(nowMs))}</span>
      <span className="h-px flex-1 bg-rose-500/60" />
    </div>
  );
}
