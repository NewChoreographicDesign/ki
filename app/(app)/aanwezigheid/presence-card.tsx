"use client";

import * as React from "react";
import { Check, Clock, History, LogIn, MessageSquare, Pencil, UserX } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PRESENCE_STATUS_META, minutesOverdue, returnState, type PresenceEntry } from "@/lib/presence-shared";
import { STATUS_ICON, STATUS_STYLE, formatDuration, formatWhen } from "./presence-ui";
import { timeAgo } from "../overdracht/handover-ui";

/**
 * One client. The primary action is always one tap and sits where a thumb
 * lands: "Terug" for someone who is away, "Aanwezig" / "Afwezig…" for someone
 * who was never registered, "Afwezig melden…" for someone who is in. Anything
 * with more choices (reason, return time, remark) opens the status sheet.
 */
export function PresenceCard({
  entry,
  now,
  pending,
  selecting,
  selected,
  onToggleSelect,
  onQuickPresent,
  onOpenSheet,
  onOpenHistory,
}: {
  entry: PresenceEntry;
  now: number;
  pending: boolean;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onQuickPresent: () => void;
  onOpenSheet: () => void;
  onOpenHistory: () => void;
}) {
  const key = entry.status ?? "NONE";
  const Icon = STATUS_ICON[key];
  const ret = returnState(entry, now);
  const late = minutesOverdue(entry, now);
  const missing = entry.status === "VERMIST";
  const away = entry.status !== null && entry.status !== "AANWEZIG";

  return (
    <li
      className={cn(
        "relative flex overflow-hidden rounded-2xl border bg-surface transition-colors",
        missing ? "border-red-500/60 bg-red-500/5" : ret === "overdue" ? "border-rose-400/50" : "border-border",
        selected && "ring-2 ring-rose-400/60",
        pending && "opacity-70"
      )}
      aria-busy={pending}
    >
      <span aria-hidden="true" className={cn("w-1.5 shrink-0", STATUS_STYLE[key].bar)} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          {selecting && <Checkbox checked={selected} onChange={onToggleSelect} aria-label={`Selecteer ${entry.name}`} className="mt-1" />}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold leading-tight text-slate-50">{entry.name}</h3>
            {entry.room && entry.room !== entry.name && <p className="text-xs text-slate-500">{entry.room}</p>}
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={`Geschiedenis van ${entry.name}`}
            className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface2 hover:text-slate-200"
          >
            <History className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", STATUS_STYLE[key].chip)}>
            <Icon className="h-4 w-4" />
            {entry.status ? PRESENCE_STATUS_META[entry.status].label : "Niet geregistreerd"}
          </span>
          {ret === "overdue" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300">
              <Clock className="h-3.5 w-3.5" /> {formatDuration(late * 60_000)} te laat
            </span>
          )}
          {entry.expectedReturnAt && ret !== "overdue" && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" /> terug {formatWhen(entry.expectedReturnAt, now)}
            </span>
          )}
          {entry.expectedReturnAt && ret === "overdue" && <span className="text-xs text-slate-400">verwacht {formatWhen(entry.expectedReturnAt, now)}</span>}
        </div>

        {entry.comment && (
          <p className="flex gap-1.5 break-words text-sm text-slate-300">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> {entry.comment}
          </p>
        )}

        {entry.changedAt && (
          <p className="text-xs text-slate-500">
            {entry.changedByName ?? "Onbekend"} · {timeAgo(entry.changedAt, now)}
          </p>
        )}

        {!selecting && (
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            {entry.status === null && (
              <>
                <ActionButton tone="ok" icon={Check} onClick={onQuickPresent} disabled={pending}>
                  Aanwezig
                </ActionButton>
                <ActionButton tone="neutral" icon={UserX} onClick={onOpenSheet} disabled={pending}>
                  Afwezig…
                </ActionButton>
              </>
            )}
            {entry.status === "AANWEZIG" && (
              <ActionButton tone="neutral" icon={UserX} onClick={onOpenSheet} disabled={pending}>
                Afwezig melden…
              </ActionButton>
            )}
            {away && (
              <>
                <ActionButton tone="ok" icon={LogIn} onClick={onQuickPresent} disabled={pending}>
                  {missing ? "Teruggevonden" : "Terug"}
                </ActionButton>
                <ActionButton tone="neutral" icon={Pencil} onClick={onOpenSheet} disabled={pending}>
                  Wijzigen
                </ActionButton>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function ActionButton({
  tone,
  icon: Icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone: "ok" | "neutral"; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "ok" ? "bg-forest-500 text-white hover:bg-forest-600 active:bg-forest-600" : "border border-border bg-transparent text-slate-100 hover:bg-surface2"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
