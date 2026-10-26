"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  agendaState,
  daysOf,
  fmtHM,
  minutesOfInstant,
  needsEscort,
  ymdOfInstant,
  type AgendaItem,
} from "@/lib/agenda-shared";
import { addDaysISO, weekdayOfISO } from "@/lib/date-shared";
import { colorOf, type ColorMode } from "./agenda-ui";

const HOUR_H = 60;
const SNAP_MIN = 15;
const MIN_LEN = 15;
const LONG_PRESS_MS = 350;
const DRAG_THRESHOLD_PX = 5;
const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** A calendar block for ONE day (a multi-day afspraak yields one per day). */
type Block = { key: string; ymd: string; startMin: number; endMin: number; item: AgendaItem; single: boolean };

function toBlocks(item: AgendaItem): Block[] {
  if (item.allDay) return [];
  const days = daysOf(item, 14);
  const startMin = minutesOfInstant(item.startAt);
  const endMin = item.endAt ? minutesOfInstant(item.endAt) : startMin + 60;
  return days.map((ymd, i) => ({
    key: `${item.id}-${ymd}`,
    ymd,
    startMin: i === 0 ? startMin : 0,
    endMin: i === days.length - 1 ? Math.max(Math.min(endMin === 0 ? 24 * 60 : endMin, 24 * 60), (i === 0 ? startMin : 0) + MIN_LEN) : 24 * 60,
    item,
    single: days.length === 1,
  }));
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

export type MovePatch = { startAt: string; endAt: string; allDay: false };

type DragView = { id: string; kind: "move" | "resize"; dMin: number; dDay: number; colWidth: number };
type DragRef = {
  block: Block;
  kind: "move" | "resize";
  pointerId: number;
  pointerType: string;
  originX: number;
  originY: number;
  colWidth: number;
  active: boolean;
  timer: number | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function AgendaGrid({
  days,
  items,
  nowMs,
  todayYmd,
  colorMode,
  hideHeadersOnPhone,
  onOpen,
  onCreateAt,
  onMove,
  onPickDay,
}: {
  days: string[];
  items: AgendaItem[];
  nowMs: number;
  todayYmd: string;
  colorMode: ColorMode;
  hideHeadersOnPhone: boolean;
  onOpen: (item: AgendaItem) => void;
  onCreateAt: (local: string) => void;
  onMove: (item: AgendaItem, patch: MovePatch) => void;
  onPickDay: (ymd: string) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const colsRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragRef | null>(null);
  const suppressClick = React.useRef(false);
  const [drag, setDrag] = React.useState<DragView | null>(null);

  const nowYmd = ymdOfInstant(nowMs);
  const nowMin = minutesOfInstant(nowMs);
  const first = days[0];

  // Land on something useful: around "now" when today is visible, else the working day's start.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = days.includes(todayYmd) && nowMin >= 8 * 60 && nowMin <= 18 * 60 ? nowMin - 90 : 7 * 60 - 30;
    el.scrollTop = (target / 60) * HOUR_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, days.length]);

  const { blocksByDay, allDayByDay } = React.useMemo(() => {
    const blocks = new Map<string, Block[]>();
    const allDay = new Map<string, AgendaItem[]>();
    for (const item of items) {
      for (const b of toBlocks(item)) {
        const list = blocks.get(b.ymd);
        if (list) list.push(b);
        else blocks.set(b.ymd, [b]);
      }
      if (item.allDay) {
        for (const ymd of daysOf(item)) {
          const list = allDay.get(ymd);
          if (list) list.push(item);
          else allDay.set(ymd, [item]);
        }
      }
    }
    return { blocksByDay: blocks, allDayByDay: allDay };
  }, [items]);

  // --- Drag (mouse: immediate after a few px; touch: long press first, so scrolling still works) ---
  const finishDrag = React.useCallback(
    (commit: boolean, view: DragView | null) => {
      const d = dragRef.current;
      if (d?.timer) window.clearTimeout(d.timer);
      dragRef.current = null;
      setDrag(null);
      if (!d?.active) return;
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      if (!commit || !view || (view.dMin === 0 && view.dDay === 0)) return;
      const { block } = d;
      const length = block.endMin - block.startMin;
      const day = addDaysISO(block.ymd, view.dDay);
      const newStart = view.kind === "move" ? clamp(block.startMin + view.dMin, 0, 24 * 60 - length) : block.startMin;
      const newEnd = view.kind === "move" ? newStart + length : clamp(block.endMin + view.dMin, newStart + MIN_LEN, 24 * 60);
      const endLocal = newEnd >= 24 * 60 ? `${addDaysISO(day, 1)}T00:00` : `${day}T${fmtHM(newEnd)}`;
      // An afspraak that had no explicit end keeps "default length" unless it was resized.
      onMove(block.item, { startAt: `${day}T${fmtHM(newStart)}`, endAt: block.item.endAt || view.kind === "resize" ? endLocal : "", allDay: false });
    },
    [onMove]
  );

  function viewFor(d: DragRef, e: { clientX: number; clientY: number }): DragView {
    const dMin = Math.round(((e.clientY - d.originY) / HOUR_H) * (60 / SNAP_MIN)) * SNAP_MIN;
    const dDay = d.kind === "move" && d.colWidth > 0 ? Math.round((e.clientX - d.originX) / d.colWidth) : 0;
    const maxDay = days.length - 1;
    const idx = days.indexOf(d.block.ymd);
    return { id: d.block.item.id, kind: d.kind, dMin, dDay: clamp(dDay, -idx, maxDay - idx), colWidth: d.colWidth };
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>, block: Block, kind: "move" | "resize") {
    if (!block.single || block.item.status !== "PLANNED" || (e.pointerType === "mouse" && e.button !== 0)) return;
    const rect = colsRef.current?.getBoundingClientRect();
    const d: DragRef = {
      block,
      kind,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      originX: e.clientX,
      originY: e.clientY,
      colWidth: rect ? rect.width / days.length : 0,
      active: false,
      timer: null,
    };
    dragRef.current = d;
    const target = e.currentTarget;
    if (e.pointerType !== "mouse") {
      d.timer = window.setTimeout(() => {
        if (dragRef.current !== d) return;
        d.active = true;
        target.setPointerCapture?.(d.pointerId);
        navigator.vibrate?.(10);
        setDrag({ id: block.item.id, kind, dMin: 0, dDay: 0, colWidth: d.colWidth });
      }, LONG_PRESS_MS);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      const moved = Math.hypot(e.clientX - d.originX, e.clientY - d.originY);
      if (d.pointerType === "mouse" && moved > DRAG_THRESHOLD_PX) {
        d.active = true;
        e.currentTarget.setPointerCapture?.(d.pointerId);
      } else {
        // Touch that moves before the long press fires is a scroll: let go.
        if (d.pointerType !== "mouse" && moved > 8) finishDrag(false, null);
        return;
      }
    }
    setDrag(viewFor(d, e));
  }

  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    finishDrag(true, d.active ? viewFor(d, e) : null);
  }

  // While a touch drag is live the page must not scroll; Escape cancels any drag.
  React.useEffect(() => {
    if (!drag) return;
    const stop = (ev: TouchEvent) => ev.preventDefault();
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && finishDrag(false, null);
    window.addEventListener("touchmove", stop, { passive: false });
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", esc);
    };
  }, [drag, finishDrag]);

  function onBlockKeyDown(e: React.KeyboardEvent, block: Block) {
    if (!e.altKey || !block.single || block.item.status !== "PLANNED") return;
    const dMin = e.key === "ArrowDown" ? SNAP_MIN : e.key === "ArrowUp" ? -SNAP_MIN : 0;
    const dDay = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dMin && !dDay) return;
    e.preventDefault();
    const length = block.endMin - block.startMin;
    const day = addDaysISO(block.ymd, dDay);
    const start = clamp(block.startMin + dMin, 0, 24 * 60 - length);
    onMove(block.item, { startAt: `${day}T${fmtHM(start)}`, endAt: block.item.endAt ? `${day}T${fmtHM(start + length)}` : "", allDay: false });
  }

  function openSlot(ymd: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = clamp(Math.round((((e.clientY - rect.top) / HOUR_H) * 60) / 30) * 30, 0, 23 * 60 + 30);
    onCreateAt(`${ymd}T${fmtHM(minutes)}`);
  }

  const hasAllDay = days.some((d) => (allDayByDay.get(d)?.length ?? 0) > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-sm">
      {/* Day headers */}
      <div className={cn("flex border-b border-border/60 bg-surface2/30", hideHeadersOnPhone && "max-md:hidden")}>
        <div className="w-12 shrink-0" />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPickDay(d)}
            aria-label={`Open ${d}`}
            className="min-w-0 flex-1 border-l border-border px-1 py-2 text-center text-xs hover:bg-surface2/60"
          >
            <span className="uppercase text-slate-500">{WEEKDAY_SHORT[weekdayOfISO(d)]}</span>{" "}
            <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold", d === todayYmd ? "bg-rose-500 text-white" : "text-slate-200")}>
              {Number(d.slice(8))}
            </span>
          </button>
        ))}
      </div>

      {/* Whole-day strip */}
      {hasAllDay && (
        <div className="flex border-b border-border bg-surface2/20">
          <div className="flex w-12 shrink-0 items-center justify-end pr-1.5 text-[10px] uppercase text-slate-500">dag</div>
          {days.map((d) => (
            <div key={d} className="flex min-w-0 flex-1 flex-col gap-0.5 border-l border-border p-0.5">
              {(allDayByDay.get(d) ?? []).map((item) => {
                const c = colorOf(item, colorMode);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item)}
                    className={cn("truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium", item.status === "CANCELLED" && "line-through opacity-60")}
                    style={{ background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}` }}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="relative max-h-[68vh] overflow-y-auto overscroll-contain">
        <div className="relative flex" style={{ height: HOUR_H * 24 }}>
          <div className="w-12 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative text-right text-[11px] text-slate-500" style={{ height: HOUR_H }}>
                {h > 0 && <span className="absolute -top-2 right-1.5">{fmtHM(h * 60)}</span>}
              </div>
            ))}
          </div>
          <div ref={colsRef} className="flex min-w-0 flex-1">
            {days.map((d) => {
              const laid = layoutDay(blocksByDay.get(d) ?? []);
              return (
                <div
                  key={d}
                  className={cn("relative min-w-0 flex-1 cursor-cell border-l border-border/50", d === todayYmd && "bg-rose-500/[0.05]", weekdayOfISO(d) >= 5 && d !== todayYmd && "bg-surface2/20")}
                  onClick={(e) => e.target === e.currentTarget && openSlot(d, e)}
                  role="presentation"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="pointer-events-none border-t border-border/30" style={{ height: HOUR_H }} />
                  ))}
                  {laid.map(({ block, col, cols }) => {
                    const item = block.item;
                    const state = agendaState(item, nowMs);
                    const c = colorOf(item, colorMode);
                    const dragging = drag?.id === item.id ? drag : null;
                    let startMin = block.startMin;
                    let endMin = block.endMin;
                    if (dragging) {
                      const length = endMin - startMin;
                      if (dragging.kind === "move") {
                        startMin = clamp(startMin + dragging.dMin, 0, 24 * 60 - length);
                        endMin = startMin + length;
                      } else endMin = clamp(endMin + dragging.dMin, startMin + MIN_LEN, 24 * 60);
                    }
                    const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_H - 2);
                    const draggable = block.single && item.status === "PLANNED";
                    return (
                      <div
                        key={block.key}
                        className={cn("absolute", dragging && "z-20")}
                        style={{
                          top: (startMin / 60) * HOUR_H + 1,
                          height,
                          left: `calc(${(col / cols) * 100}% + 1px)`,
                          width: `calc(${100 / cols}% - 3px)`,
                          transform: dragging && dragging.dDay !== 0 ? `translateX(${dragging.dDay * dragging.colWidth}px)` : undefined,
                          touchAction: dragging ? "none" : undefined,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!suppressClick.current) onOpen(item);
                          }}
                          onPointerDown={draggable ? (e) => onPointerDown(e, block, "move") : undefined}
                          onPointerMove={draggable ? onPointerMove : undefined}
                          onPointerUp={draggable ? onPointerUp : undefined}
                          onPointerCancel={draggable ? () => finishDrag(false, null) : undefined}
                          onKeyDown={(e) => onBlockKeyDown(e, block)}
                          onContextMenu={draggable ? (e) => e.preventDefault() : undefined}
                          aria-label={`${item.title}, ${fmtHM(startMin)}${item.clientName ? `, ${item.clientName}` : ""}${state === "cancelled" ? ", geannuleerd" : ""}. Open details${draggable ? ". Alt plus pijltjes verplaatst." : ""}`}
                          className={cn(
                            "h-full w-full select-none overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-xs leading-snug transition-[filter,box-shadow] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400",
                            draggable && "cursor-grab active:cursor-grabbing",
                            dragging && "shadow-lift ring-2 ring-rose-400/70",
                            state === "cancelled" && "border-dashed opacity-55",
                            state === "done" && "opacity-65",
                            state === "to-finish" && "ring-1 ring-amber-400/60"
                          )}
                          style={{ background: c.bg, borderColor: c.border, color: c.text }}
                        >
                          <span className={cn("flex items-center gap-1 truncate font-semibold", state === "cancelled" && "line-through")}>
                            {state === "done" && <Check className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{item.title}</span>
                          </span>
                          {height > 34 && (
                            <span className="block truncate opacity-80">
                              {fmtHM(startMin)}
                              {dragging || !item.endAt ? "" : `–${fmtHM(endMin % (24 * 60))}`}
                              {item.clientName ? ` · ${item.clientName}` : ""}
                            </span>
                          )}
                          {height > 52 && needsEscort(item, nowMs) && <span className="block truncate text-amber-200">Nog niemand gaat mee</span>}
                        </button>
                        {draggable && (
                          <span
                            role="presentation"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              onPointerDown(e, block, "resize");
                            }}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={() => finishDrag(false, null)}
                            className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize"
                          >
                            <span className="mx-auto mt-1 block h-0.5 w-6 rounded-full bg-current opacity-40" style={{ color: c.text }} />
                          </span>
                        )}
                      </div>
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
    </div>
  );
}
