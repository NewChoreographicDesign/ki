import type * as React from "react";
import { CalendarClock, ClipboardList, HeartPulse, Home, Pill, Tag } from "lucide-react";
import {
  amsterdamNow,
  daysOverdue,
  diffDaysISO,
  isLate,
  minutesOfTime,
  relativeDayLabel,
  todoBucket,
  type TodoCategoryKey,
  type TodoData,
  type TodoEventView,
} from "@/lib/todos-shared";

type Icon = React.ComponentType<{ className?: string }>;

export const CATEGORY_ICON: Record<TodoCategoryKey, Icon> = {
  ZORG: HeartPulse,
  MEDICATIE: Pill,
  HUISHOUDING: Home,
  ADMINISTRATIE: ClipboardList,
  AFSPRAAK: CalendarClock,
  OVERIG: Tag,
};

// ki's own hue families only (rose/forest/amber/slate) — no violet/sky,
// which this app has never used. The icon is each category's primary
// signal; color is secondary, so two categories sharing a tone is fine.
export const CATEGORY_CHIP: Record<TodoCategoryKey, string> = {
  ZORG: "bg-rose-500/15 text-rose-300",
  MEDICATIE: "bg-amber-500/15 text-amber-300",
  HUISHOUDING: "bg-forest-500/15 text-forest-300",
  ADMINISTRATIE: "bg-slate-500/20 text-slate-300",
  AFSPRAAK: "bg-rose-500/10 text-rose-300",
  OVERIG: "bg-slate-500/15 text-slate-400",
};

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(ms));
}

/** "vandaag 15:00", "morgen 08:00", "ma 26 okt 08:00" — for snooze and completion stamps. */
export function formatMoment(iso: string, nowMs: number): string {
  const date = amsterdamNow(new Date(iso).getTime()).dateISO;
  return `${relativeDayLabel(date, amsterdamNow(nowMs).dateISO)} ${formatClock(new Date(iso).getTime())}`;
}

export type DueChip = { text: string; tone: "late" | "today" | "soon" | "muted" };

/** The one date/time signal on a card: how late it is, or when it is due. */
export function dueChip(todo: TodoData, nowMs: number): DueChip | null {
  if (todo.completed) return null;
  const bucket = todoBucket(todo, nowMs);
  if (bucket === "overdue") {
    const days = daysOverdue(todo, nowMs);
    return { text: days <= 1 ? "Gisteren verlopen" : `${days} dagen te laat`, tone: "late" };
  }
  if (isLate(todo, nowMs)) {
    const behind = amsterdamNow(nowMs).minutes - (minutesOfTime(todo.time) ?? 0);
    return { text: behind >= 60 ? `${Math.floor(behind / 60)} uur te laat` : `${behind} min te laat`, tone: "late" };
  }
  if (todo.dueDate) {
    const today = amsterdamNow(nowMs).dateISO;
    const diff = diffDaysISO(todo.dueDate.slice(0, 10), today);
    return { text: diff === 0 ? "Vandaag uiterlijk" : `Uiterlijk ${relativeDayLabel(todo.dueDate.slice(0, 10), today)}`, tone: diff <= 1 ? "today" : "muted" };
  }
  return null;
}

export const DUE_TONE_CLASS: Record<DueChip["tone"], string> = {
  late: "bg-red-500/15 text-red-400",
  today: "bg-amber-500/15 text-amber-400",
  soon: "bg-amber-500/15 text-amber-400",
  muted: "bg-slate-500/15 text-slate-300",
};

export type ApiResult = {
  ok: boolean;
  status: number;
  data: {
    error?: string;
    todo?: TodoData;
    events?: TodoEventView[];
    current?: TodoData;
    conflict?: boolean;
    open?: TodoData[];
    completed?: TodoData[];
    updated?: number;
    ids?: string[];
    details?: { fieldErrors?: Record<string, string[] | undefined> };
  };
};

/** JSON request that never throws: network failures come back as { ok: false, status: 0 }. */
export async function api(url: string, method: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Geen verbinding. Probeer het opnieuw." } };
  }
}

/** The most helpful message in an error response: the first field error, else the server's text, else the fallback. */
export function apiMessage(result: ApiResult, fallback: string): string {
  const field = Object.values(result.data.details?.fieldErrors ?? {}).flat().find(Boolean);
  return field || result.data.error || fallback;
}
