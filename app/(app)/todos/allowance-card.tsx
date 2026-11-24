"use client";

import { Check, Pause, Play, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ALLOWANCE_STATE_LABEL,
  ALLOWANCE_TYPE_META,
  effectiveAllowanceState,
  formatClockTime,
  formatCountdown,
  formatDurationCoarse,
  remainingMs,
  totalAllowanceMs,
  type AllowanceData,
  type AllowanceEffectiveState,
} from "@/lib/allowances-shared";
import { ALLOWANCE_TYPE_ICON } from "./allowance-ui";

type Action = "start" | "pause" | "resume" | "complete" | "extend";

const STATE_BADGE: Record<AllowanceEffectiveState, "rose" | "amber" | "slate" | "default" | "red" | "forest"> = {
  running: "rose",
  soon: "amber",
  paused: "slate",
  scheduled: "default",
  expired: "red",
  completed: "forest",
};
const STATE_ICON_WRAP: Record<AllowanceEffectiveState, string> = {
  running: "bg-rose-500/15 text-rose-400",
  soon: "bg-amber-500/15 text-amber-400",
  paused: "bg-surface2 text-slate-300",
  scheduled: "bg-surface2 text-slate-400",
  expired: "bg-red-500/15 text-red-400",
  completed: "bg-forest-500/15 text-forest-400",
};
const STATE_BAR: Record<AllowanceEffectiveState, string> = {
  running: "bg-rose-400",
  soon: "bg-amber-400",
  paused: "bg-slate-400",
  scheduled: "bg-border",
  expired: "bg-red-400",
  completed: "bg-forest-400",
};
const STATE_TEXT: Record<AllowanceEffectiveState, string> = {
  running: "text-rose-400",
  soon: "text-amber-400",
  paused: "text-slate-200",
  scheduled: "text-slate-300",
  expired: "text-red-400",
  completed: "text-forest-400",
};

export function AllowanceCard({
  allowance,
  now,
  busy,
  onAction,
}: {
  allowance: AllowanceData;
  now: number;
  busy: boolean;
  onAction: (action: Action) => void;
}) {
  const state = effectiveAllowanceState(allowance, now);
  const Icon = ALLOWANCE_TYPE_ICON[allowance.type];
  const left = remainingMs(allowance, now);
  const total = totalAllowanceMs(allowance, allowance.createdAt);
  const pct = state === "completed" ? 100 : state === "scheduled" ? 0 : Math.max(0, Math.min(100, 100 * (1 - left / total)));

  let timerBig: string;
  let timerLabel: string;
  if (allowance.mode === "DURATION") {
    timerBig = formatCountdown(state === "expired" ? left : Math.max(left, 0));
    timerLabel = state === "expired" ? "te lang in gebruik" : state === "paused" ? "resterend, gepauzeerd" : "resterend";
  } else if (state === "scheduled") {
    timerBig = formatClockTime(allowance.startAt!);
    timerLabel = "nog te starten";
  } else if (state === "expired") {
    timerBig = formatCountdown(left);
    timerLabel = "over de tijd";
  } else {
    timerBig = formatDurationCoarse(Math.max(left, 0));
    timerLabel = "resterend";
  }

  const sub =
    allowance.mode === "DURATION"
      ? `Timer · ${formatDurationCoarse(total)} toegestaan`
      : state === "scheduled"
        ? `Vanaf ${formatClockTime(allowance.startAt!)} tot ${formatClockTime(allowance.endsAt!)}`
        : `Toegestaan tot ${formatClockTime(allowance.endsAt!)}`;

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4">
      <div className={cn("absolute inset-y-0 left-0 w-1", STATE_BAR[state])} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", STATE_ICON_WRAP[state])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">
            {ALLOWANCE_TYPE_META[allowance.type].label} — {allowance.clientName}
          </p>
          <p className="text-xs text-slate-500">
            {allowance.clientRoom ? `${allowance.clientRoom} · ` : ""}
            {sub}
          </p>
        </div>
        <Badge variant={STATE_BADGE[state]} className="shrink-0">
          {ALLOWANCE_STATE_LABEL[state]}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={cn("text-xl font-semibold tabular-nums", STATE_TEXT[state])}>{timerBig}</span>
        <span className="text-[11px] text-slate-500">{timerLabel}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
        <div className={cn("h-full rounded-full transition-[width] duration-500", STATE_BAR[state])} style={{ width: `${pct}%` }} />
      </div>

      {allowance.note && <p className="rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-slate-300">{allowance.note}</p>}

      <div className="flex flex-wrap gap-2">
        {state === "scheduled" && (
          <Button size="sm" onClick={() => onAction("start")} disabled={busy}>
            <Play className="h-3.5 w-3.5" /> Start nu
          </Button>
        )}
        {(state === "running" || state === "soon") && (
          <>
            {allowance.mode === "DURATION" && (
              <Button size="sm" variant="outline" onClick={() => onAction("pause")} disabled={busy}>
                <Pause className="h-3.5 w-3.5" /> Pauzeer
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onAction("complete")} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Beëindigen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction("extend")} disabled={busy}>
              <Plus className="h-3.5 w-3.5" /> 15 min
            </Button>
          </>
        )}
        {state === "paused" && (
          <>
            <Button size="sm" onClick={() => onAction("resume")} disabled={busy}>
              <Play className="h-3.5 w-3.5" /> Hervat
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("complete")} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Beëindigen
            </Button>
          </>
        )}
        {state === "expired" && (
          <>
            <Button size="sm" variant="danger" onClick={() => onAction("complete")} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Ophalen / afronden
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction("extend")} disabled={busy}>
              <Plus className="h-3.5 w-3.5" /> 15 min
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
