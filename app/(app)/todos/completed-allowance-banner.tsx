"use client";

import { CheckCircle2 } from "lucide-react";
import { ALLOWANCE_TYPE_META, formatClockTime, formatDurationCoarse, totalAllowanceMs, type AllowanceData } from "@/lib/allowances-shared";

/**
 * A finished allowance shows here, above the still-open Werklijst tasks,
 * instead of in a "voltooid" archive like a routine todo — the action it
 * needs (go collect the phone, see the visitor out) is time-sensitive in a
 * way a finished chore isn't.
 */
export function CompletedAllowanceBanner({ items }: { items: AllowanceData[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Toegestane tijd, zojuist klaar" className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold text-forest-300">
        Toegestane tijd — zojuist klaar
        <span className="text-xs font-normal tabular-nums text-slate-500">{items.length}</span>
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-forest-500/25 bg-forest-500/10 px-3.5 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-500 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">
                {ALLOWANCE_TYPE_META[a.type].label} — {a.clientName} is afgerond
              </p>
              <p className="text-xs text-slate-500">
                {a.clientRoom ? `${a.clientRoom} · ` : ""}
                {formatDurationCoarse(a.usedMs)} gebruikt van {formatDurationCoarse(totalAllowanceMs(a, a.createdAt))}
              </p>
            </div>
            {a.completedAt && <span className="shrink-0 text-xs text-slate-500">{formatClockTime(a.completedAt)}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
