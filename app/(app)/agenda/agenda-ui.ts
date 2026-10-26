import type * as React from "react";
import { Bus, CalendarClock, HeartPulse, PartyPopper, Stethoscope, Tag, Users } from "lucide-react";
import { colorForCategory, colorForClient, type AgendaColor } from "@/lib/agenda-colors";
import {
  agendaState,
  AGENDA_CATEGORY_META,
  endMs,
  fmtHM,
  formatAgendaTime,
  minutesOfInstant,
  startMs,
  ymdOfInstant,
  type AgendaCategoryKey,
  type AgendaItem,
} from "@/lib/agenda-shared";
import { dayHeading } from "@/lib/agenda-shared";

type Icon = React.ComponentType<{ className?: string }>;

export const CATEGORY_ICON: Record<AgendaCategoryKey, Icon> = {
  MEDISCH: Stethoscope,
  PARAMEDISCH: HeartPulse,
  FAMILIE: Users,
  ACTIVITEIT: PartyPopper,
  OVERLEG: CalendarClock,
  VERVOER: Bus,
  OVERIG: Tag,
};

export type ColorMode = "client" | "category";

export function colorOf(item: Pick<AgendaItem, "clientId" | "category">, mode: ColorMode): AgendaColor {
  return mode === "category" ? colorForCategory(item.category) : colorForClient(item.clientId);
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export type ApiResult = {
  ok: boolean;
  status: number;
  // The routes answer with a handful of shapes; callers read what they expect.
  data: any;
};

export async function api(url: string, method = "GET", body?: unknown): Promise<ApiResult> {
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
  const field = Object.values((result.data?.details?.fieldErrors ?? {}) as Record<string, string[]>).flat().find(Boolean);
  return field || result.data?.error || fallback;
}

const REL = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });

/** "nu bezig", "over 25 min", "over 3 uur", "morgen", "3 dagen geleden" — one short phrase for the card. */
export function whenPhrase(item: AgendaItem, nowMs: number): string {
  const state = agendaState(item, nowMs);
  if (state === "ongoing") return "Nu bezig";
  const diffMin = Math.round((startMs(item) - nowMs) / 60_000);
  if (item.allDay) return "";
  if (Math.abs(diffMin) < 60) return REL.format(diffMin, "minute");
  if (Math.abs(diffMin) < 24 * 60) return REL.format(Math.round(diffMin / 60), "hour");
  return "";
}

/** "donderdag 22 oktober · 14:00 – 15:00", for the detail sheet. */
export function fullWhen(item: AgendaItem, todayYmd: string): string {
  const days = ymdOfInstant(item.startAt);
  const lastDay = ymdOfInstant(Math.max(startMs(item), endMs(item) - 1));
  const head = dayHeading(days, todayYmd);
  if (item.allDay) return lastDay > days ? `${head} t/m ${dayHeading(lastDay, todayYmd)}` : `${head} · hele dag`;
  const end = item.endAt ? new Date(item.endAt) : null;
  if (end && ymdOfInstant(end) !== days) return `${head} ${fmtHM(minutesOfInstant(item.startAt))} – ${dayHeading(ymdOfInstant(end), todayYmd)} ${fmtHM(minutesOfInstant(end))}`;
  return `${head} · ${formatAgendaTime(item)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function labelCategory(key: AgendaCategoryKey | null): string {
  return key ? AGENDA_CATEGORY_META[key].label : "";
}
