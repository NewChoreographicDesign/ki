"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CalendarClock, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playAlertSound, requestNotificationPermissionOnce } from "@/lib/reminder-alerts";

type MedicationDue = {
  medicationId: string;
  medicationName: string;
  clientId: string;
  clientName: string;
  time: string;
  minutesUntil: number;
};

type AppointmentDue = {
  appointmentId: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  startAt: string;
  minutesUntil: number;
};

type WeekPlanDue = {
  weekPlanId: string;
  activity: string;
  clientId: string;
  clientName: string;
  time: string;
  minutesUntil: number;
};

type ReminderItem = {
  key: string;
  kind: "medicatie" | "afspraak" | "weekplanning";
  title: string;
  subtitle: string | null;
  timeLabel: string;
  minutesUntil: number;
  href: string | null;
  notifyTitle: string;
  notifyBody: string;
};

const POLL_MS = 30_000;

const KIND_STYLES = {
  medicatie: {
    icon: Bell,
    border: "border-amber-400/40",
    bg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    textColor: "text-amber-200",
    linkColor: "text-amber-300",
  },
  afspraak: {
    icon: CalendarClock,
    border: "border-sky-400/40",
    bg: "bg-sky-500/15",
    iconColor: "text-sky-400",
    textColor: "text-sky-200",
    linkColor: "text-sky-300",
  },
  weekplanning: {
    icon: CalendarDays,
    border: "border-emerald-400/40",
    bg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    textColor: "text-emerald-200",
    linkColor: "text-emerald-300",
  },
} as const;

function formatAmsterdamTime(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

function minutesLabel(minutesUntil: number, time: string): string {
  if (minutesUntil > 0) return `Over ${minutesUntil} ${minutesUntil === 1 ? "minuut" : "minuten"} (${time})`;
  if (minutesUntil === 0) return `Nu (${time})`;
  return `Was ${Math.abs(minutesUntil)} min geleden (${time})`;
}

async function fetchDue<T>(endpoint: string): Promise<T[]> {
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data: { due: T[] } = await res.json();
  return data.due;
}

/**
 * One combined banner stack for every "due soon" reminder in the app —
 * medicatie, agenda-afspraken, and weekplanning — polling all three sources
 * together (30s) while the app is open, alerting with a sound + this in-app
 * banner and a best-effort OS notification where permission allows.
 *
 * This is deliberately ONE component rather than three separate watchers:
 * each would anchor to the same fixed top-of-screen position, so if a
 * medication and an appointment ever came due at the same moment they'd
 * render on top of each other instead of stacking. Combining them into a
 * single sorted list is what makes that layout correct.
 *
 * This only works while a browser tab/PWA is actually open; true background
 * push (alerting even when the app is fully closed) would need a service
 * worker + Web Push subscription infrastructure, which is a much larger
 * build than this covers. In practice the app runs on a shared iPad left
 * open at the nursing station, so "open tab" is the realistic deployment.
 */
export function ReminderWatcher() {
  const [items, setItems] = React.useState<ReminderItem[]>([]);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const alertedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    requestNotificationPermissionOnce();
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [medication, appointments, weekPlans] = await Promise.all([
          fetchDue<MedicationDue>("/api/medication-reminders/due"),
          fetchDue<AppointmentDue>("/api/appointment-reminders/due"),
          fetchDue<WeekPlanDue>("/api/weekplan-reminders/due"),
        ]);
        if (cancelled) return;

        const due: ReminderItem[] = [
          ...medication.map((r) => ({
            key: `medicatie:${r.medicationId}|${r.time}`,
            kind: "medicatie" as const,
            title: r.medicationName,
            subtitle: r.clientName,
            timeLabel: minutesLabel(r.minutesUntil, r.time),
            minutesUntil: r.minutesUntil,
            href: `/medicatie/${r.clientId}`,
            notifyTitle: "Medicatie",
            notifyBody: `${r.medicationName} voor ${r.clientName} om ${r.time}`,
          })),
          ...appointments.map((r) => ({
            key: `afspraak:${r.appointmentId}`,
            kind: "afspraak" as const,
            title: r.title,
            subtitle: r.clientName,
            timeLabel: minutesLabel(r.minutesUntil, formatAmsterdamTime(r.startAt)),
            minutesUntil: r.minutesUntil,
            href: "/agenda",
            notifyTitle: "Afspraak",
            notifyBody: `${r.title}${r.clientName ? ` · ${r.clientName}` : ""} om ${formatAmsterdamTime(r.startAt)}`,
          })),
          ...weekPlans.map((r) => ({
            key: `weekplanning:${r.weekPlanId}|${r.time}`,
            kind: "weekplanning" as const,
            title: r.activity,
            subtitle: r.clientName,
            timeLabel: minutesLabel(r.minutesUntil, r.time),
            minutesUntil: r.minutesUntil,
            // Weekplanning is only editable from Backend (admin-only), so
            // there's no page every role can click through to — the banner
            // text itself is the whole point for everyone else.
            href: null,
            notifyTitle: "Weekplanning",
            notifyBody: `${r.activity} · ${r.clientName} om ${r.time}`,
          })),
        ].sort((a, b) => a.minutesUntil - b.minutesUntil);

        const currentKeys = new Set(due.map((item) => item.key));
        const newlyDue = due.filter((item) => !alertedRef.current.has(item.key));

        if (newlyDue.length > 0) {
          playAlertSound();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const item of newlyDue) {
              new Notification(item.notifyTitle, { body: item.notifyBody, tag: item.key });
            }
          }
          newlyDue.forEach((item) => alertedRef.current.add(item.key));
        }

        alertedRef.current = new Set([...alertedRef.current].filter((k) => currentKeys.has(k)));
        setDismissed((prev) => new Set([...prev].filter((k) => currentKeys.has(k))));
        setItems(due);
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

  const visible = items.filter((item) => !dismissed.has(item.key));
  if (visible.length === 0) return null;

  function dismiss(key: string) {
    setDismissed((prev) => new Set(prev).add(key));
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-col gap-2 p-3 sm:left-auto sm:right-3 sm:w-96">
      {visible.map((item) => {
        const style = KIND_STYLES[item.kind];
        const Icon = style.icon;
        return (
          <div
            key={item.key}
            className={`flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} p-4 shadow-lg backdrop-blur`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} />
            <div className="flex-1">
              <p className="font-medium text-slate-50">
                {item.title}
                {item.subtitle && <> &middot; {item.subtitle}</>}
              </p>
              <p className={`text-sm ${style.textColor}`}>{item.timeLabel}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className={`mt-1 inline-block text-sm hover:underline ${style.linkColor}`}
                  onClick={() => dismiss(item.key)}
                >
                  Naar {item.kind === "medicatie" ? "Medicatie" : "Agenda"} →
                </Link>
              )}
            </div>
            <Button size="icon" variant="ghost" aria-label="Sluiten" onClick={() => dismiss(item.key)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
