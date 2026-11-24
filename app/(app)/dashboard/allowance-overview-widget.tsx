"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Check, Pause, Play, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  ALLOWANCE_TYPE_META,
  effectiveAllowanceState,
  formatCountdown,
  formatDurationCoarse,
  remainingMs,
  type AllowanceData,
  type AllowanceEffectiveState,
} from "@/lib/allowances-shared";

type ApiResult = { ok: boolean; data: { allowance?: AllowanceData; error?: string } };
async function patchAllowance(id: string, action: string): Promise<ApiResult> {
  try {
    const res = await fetch(`/api/allowances/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Geen verbinding" } };
  }
}

const STATE_TEXT: Record<AllowanceEffectiveState, string> = {
  running: "text-rose-400",
  soon: "text-amber-400",
  paused: "text-slate-300",
  scheduled: "text-slate-400",
  expired: "text-red-400",
  completed: "text-forest-400",
};

const POLL_MS = 20_000;

/**
 * Live, cross-surface proof that Toegestane tijd isn't just a Werklijst
 * screen: the same records, pausable/resumable from here too. Only the
 * actively-relevant ones (running/about to run out/paused/expired) — a
 * scheduled-for-later or already-finished allowance belongs on the
 * Werklijst, not cluttering the dashboard.
 */
export function AllowanceOverviewWidget({ initialActive, serverNow }: { initialActive: AllowanceData[]; serverNow: number }) {
  const [items, setItems] = React.useState(initialActive);
  const [now, setNow] = React.useState(serverNow);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const epoch = React.useRef(0);

  React.useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const refresh = React.useCallback(async () => {
    const startedAt = epoch.current;
    try {
      const res = await fetch("/api/allowances", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (epoch.current !== startedAt || !Array.isArray(data.active)) return;
      setItems(data.active);
    } catch {
      // A failed background refresh just leaves the last known state showing.
    }
  }, []);

  React.useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(poll);
  }, [refresh]);

  const relevant = items
    .map((a) => ({ a, state: effectiveAllowanceState(a, now) }))
    .filter(({ state }) => state === "running" || state === "soon" || state === "paused" || state === "expired")
    .sort((a, b) => {
      const order: Record<string, number> = { expired: 0, running: 1, soon: 1, paused: 2 };
      return (order[a.state] ?? 3) - (order[b.state] ?? 3) || remainingMs(a.a, now) - remainingMs(b.a, now);
    });

  async function act(a: AllowanceData, action: "pause" | "resume" | "complete") {
    setBusyId(a.id);
    const res = await patchAllowance(a.id, action);
    setBusyId(null);
    if (!res.ok || !res.data.allowance) {
      toast.error(res.data.error || "Actie mislukt");
      return;
    }
    epoch.current++;
    const updated = res.data.allowance;
    setItems((prev) => prev.filter((x) => x.id !== updated.id).concat(updated.status === "COMPLETED" ? [] : [updated]));
    if (updated.status === "COMPLETED") toast.success("Afgerond en naar de werklijst gezet.");
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Toegestane tijd nu</h2>
        <Link href="/todos" className="text-sm font-medium text-rose-400 hover:text-rose-300">
          Alles beheren →
        </Link>
      </div>
      {relevant.length === 0 ? (
        <EmptyState icon={Timer} title="Niemand heeft nu toegestane tijd lopen." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {relevant.map(({ a, state }) => {
            const left = remainingMs(a, now);
            const timeText = state === "expired" ? `-${formatCountdown(left).replace("-", "")}` : a.mode === "DURATION" ? formatCountdown(Math.max(left, 0)) : formatDurationCoarse(Math.max(left, 0));
            return (
              <div key={a.id} className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-xs font-semibold text-rose-400">
                  {a.clientName
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{a.clientName}</p>
                  <p className="truncate text-xs text-slate-500">{ALLOWANCE_TYPE_META[a.type].label}</p>
                </div>
                <span className={cn("shrink-0 text-base font-semibold tabular-nums", STATE_TEXT[state])}>{timeText}</span>
                <div className="flex shrink-0 gap-1.5">
                  {state === "paused" ? (
                    <button
                      type="button"
                      onClick={() => void act(a, "resume")}
                      disabled={busyId === a.id}
                      aria-label="Hervat"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface2 text-slate-200 hover:border-slate-500/50 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  ) : state === "expired" ? (
                    <button
                      type="button"
                      onClick={() => void act(a, "complete")}
                      disabled={busyId === a.id}
                      aria-label="Ophalen / afronden"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:border-red-500/60 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    a.mode === "DURATION" && (
                      <button
                        type="button"
                        onClick={() => void act(a, "pause")}
                        disabled={busyId === a.id}
                        aria-label="Pauzeer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface2 text-slate-200 hover:border-slate-500/50 disabled:opacity-50"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
