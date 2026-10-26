"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { compareAgenda, daysOf, fmtHM, minutesOfInstant, type AgendaItem } from "@/lib/agenda-shared";
import { addDaysISO, weekdayOfISO } from "@/lib/date-shared";
import { colorOf, type ColorMode } from "./agenda-ui";

const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MAX_CHIPS = 3;

/** Month overview: up to three chips per day, "+N meer" opens that day. */
export function AgendaMonth({
  anchor,
  todayYmd,
  items,
  colorMode,
  onPickDay,
  onOpen,
}: {
  anchor: string;
  todayYmd: string;
  items: AgendaItem[];
  colorMode: ColorMode;
  onPickDay: (ymd: string) => void;
  onOpen: (item: AgendaItem) => void;
}) {
  const first = `${anchor.slice(0, 8)}01`;
  const start = addDaysISO(first, -weekdayOfISO(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDaysISO(start, i));
  const weeks = cells.slice(35).every((d) => d.slice(0, 7) !== anchor.slice(0, 7)) ? 5 : 6;

  const byDay = React.useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const item of [...items].sort(compareAgenda)) {
      for (const ymd of daysOf(item)) {
        const list = map.get(ymd);
        if (list) list.push(item);
        else map.set(ymd, [item]);
      }
    }
    return map;
  }, [items]);

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
          const list = byDay.get(d) ?? [];
          const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
          return (
            <div key={d} className={cn("min-h-[5.5rem] border-b border-l border-border p-1 sm:min-h-[6.5rem]", !inMonth && "bg-surface2/20", d === todayYmd && "bg-rose-500/[0.05]")}>
              <button
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={`${Number(d.slice(8))} — ${list.length} ${list.length === 1 ? "afspraak" : "afspraken"}`}
                className={cn(
                  "mb-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold",
                  d === todayYmd ? "bg-rose-500 text-white" : inMonth ? "text-slate-200 hover:bg-surface2" : "text-slate-600"
                )}
              >
                {Number(d.slice(8))}
              </button>
              <div className="flex flex-col gap-0.5">
                {list.slice(0, MAX_CHIPS).map((item) => {
                  const c = colorOf(item, colorMode);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpen(item)}
                      className={cn("flex items-center gap-0.5 truncate rounded px-1 text-left text-xs leading-4 sm:text-xs", item.status === "CANCELLED" && "line-through opacity-55", item.status === "DONE" && "opacity-70")}
                      style={{ background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}` }}
                    >
                      {item.status === "DONE" && <Check className="h-3 w-3 shrink-0" />}
                      <span className="hidden sm:inline">{item.allDay ? "" : `${fmtHM(minutesOfInstant(item.startAt))} `}</span>
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
                {list.length > MAX_CHIPS && (
                  <button type="button" onClick={() => onPickDay(d)} className="text-left text-xs text-slate-500 hover:text-slate-300">
                    +{list.length - MAX_CHIPS} meer
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
