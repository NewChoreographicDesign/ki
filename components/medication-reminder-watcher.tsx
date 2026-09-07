"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DueReminder = {
  medicationId: string;
  medicationName: string;
  clientId: string;
  clientName: string;
  time: string;
  minutesUntil: number;
};

const POLL_MS = 30_000;

function reminderKey(r: DueReminder): string {
  return `${r.medicationId}|${r.time}`;
}

/** Three ascending beeps via the Web Audio API — no audio asset to bundle/host. */
function playAlertSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [660, 880, 1046.5].forEach((freq, i) => {
      const start = now + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Audio can fail for all sorts of environment reasons (autoplay policy,
    // no audio hardware, ...) — the visible banner below is the reliable
    // fallback, so a sound failure here is never worth surfacing as an error.
  }
}

/**
 * Polls for medications due within 5 minutes (see lib/medication-reminders.ts)
 * while the app is open, and alerts with a sound + this in-app banner —
 * plus a best-effort OS notification where permission allows. This only
 * works while a browser tab/PWA is actually open; true background push
 * (alerting even when the app is fully closed) would need a service worker
 * + Web Push subscription infrastructure, which is a much larger build than
 * this covers. In practice the app runs on a shared iPad left open at the
 * nursing station, so "open tab" is the realistic deployment already.
 */
export function MedicationReminderWatcher() {
  const [dueList, setDueList] = React.useState<DueReminder[]>([]);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const alertedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/medication-reminders/due");
        if (!res.ok || cancelled) return;
        const data: { due: DueReminder[] } = await res.json();
        if (cancelled) return;

        const currentKeys = new Set(data.due.map(reminderKey));
        const newlyDue = data.due.filter((r) => !alertedRef.current.has(reminderKey(r)));

        if (newlyDue.length > 0) {
          playAlertSound();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const r of newlyDue) {
              new Notification("Medicatie", {
                body: `${r.medicationName} voor ${r.clientName} om ${r.time}`,
                tag: reminderKey(r),
              });
            }
          }
          newlyDue.forEach((r) => alertedRef.current.add(reminderKey(r)));
        }

        // Prune bookkeeping for reminders that dropped out (checked off, or
        // past the overdue window) so a long-running session doesn't just
        // accumulate keys forever, and so the same slot can alert again on
        // some future day.
        alertedRef.current = new Set([...alertedRef.current].filter((k) => currentKeys.has(k)));
        setDismissed((prev) => new Set([...prev].filter((k) => currentKeys.has(k))));
        setDueList(data.due);
      } catch {
        // A failed poll just tries again in POLL_MS — no need to surface it.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const visible = dueList.filter((r) => !dismissed.has(reminderKey(r)));
  if (visible.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-col gap-2 p-3 sm:left-auto sm:right-3 sm:w-96">
      {visible.map((r) => (
        <div
          key={reminderKey(r)}
          className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/15 p-4 shadow-lg backdrop-blur"
        >
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="font-medium text-slate-50">
              {r.medicationName} &middot; {r.clientName}
            </p>
            <p className="text-sm text-amber-200">
              {r.minutesUntil > 0
                ? `Over ${r.minutesUntil} ${r.minutesUntil === 1 ? "minuut" : "minuten"} (${r.time})`
                : r.minutesUntil === 0
                  ? `Nu (${r.time})`
                  : `Te laat sinds ${Math.abs(r.minutesUntil)} min (${r.time})`}
            </p>
            <Link
              href={`/medicatie/${r.clientId}`}
              className="mt-1 inline-block text-sm text-sky-300 hover:underline"
              onClick={() => setDismissed((prev) => new Set(prev).add(reminderKey(r)))}
            >
              Naar Medicatie →
            </Link>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Sluiten"
            onClick={() => setDismissed((prev) => new Set(prev).add(reminderKey(r)))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
