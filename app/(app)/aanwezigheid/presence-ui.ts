import { AlertTriangle, Briefcase, CircleHelp, Home, MapPin, Plane, Stethoscope, BedDouble, type LucideIcon } from "lucide-react";
import { AMSTERDAM_TZ } from "@/lib/utils";
import type { PresenceStatusKey } from "@/lib/presence-shared";

export type StatusKey = PresenceStatusKey | "NONE";

export const STATUS_ICON: Record<StatusKey, LucideIcon> = {
  AANWEZIG: Home,
  LOGEREN: BedDouble,
  DAGBESTEDING: Briefcase,
  ZIEKENHUIS: Stethoscope,
  VERLOF: Plane,
  ANDERS: MapPin,
  VERMIST: AlertTriangle,
  NONE: CircleHelp,
};

// Colour is never the only signal: every status also has an icon and a label.
export const STATUS_STYLE: Record<StatusKey, { bar: string; chip: string }> = {
  AANWEZIG: { bar: "bg-forest-500", chip: "bg-forest-500/15 text-forest-300" },
  LOGEREN: { bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300" },
  DAGBESTEDING: { bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300" },
  ZIEKENHUIS: { bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300" },
  VERLOF: { bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300" },
  ANDERS: { bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300" },
  // Matches components/ui/badge.tsx's `red` variant and button.tsx's
  // `danger` variant — ki's one existing convention for "risk", reused
  // here rather than inventing a new token.
  VERMIST: { bar: "bg-red-500", chip: "bg-red-500/15 text-red-400" },
  NONE: { bar: "bg-slate-600", chip: "bg-slate-500/15 text-slate-300" },
};

const dayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: AMSTERDAM_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: AMSTERDAM_TZ, hour: "2-digit", minute: "2-digit" });
const longDayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: AMSTERDAM_TZ, weekday: "short", day: "numeric", month: "short" });

/** "14:05" in Amsterdam time, the same on server and browser. */
export function formatClock(ms: number): string {
  return timeFmt.format(new Date(ms));
}

/** "vandaag 16:00", "morgen 09:00", "ma 26 okt 09:00". */
export function formatWhen(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const time = timeFmt.format(d);
  const key = dayFmt.format(d);
  if (key === dayFmt.format(new Date(now))) return `vandaag ${time}`;
  if (key === dayFmt.format(new Date(now + 24 * 3_600_000))) return `morgen ${time}`;
  if (key === dayFmt.format(new Date(now - 24 * 3_600_000))) return `gisteren ${time}`;
  return `${longDayFmt.format(d)} ${time}`;
}

/** "3 uur", "25 min", "2 dagen" — a duration, no direction. */
export function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} uur`;
  return `${Math.round(h / 24)} dagen`;
}

/** Value for an <input type="datetime-local"> in the browser's own time zone. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type ReturnPreset = { key: string; label: string; at: Date };

/** Quick choices for the expected return — what a shift actually says out loud. */
export function returnPresets(now: Date = new Date()): ReturnPreset[] {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const presets: ReturnPreset[] = [{ key: "1h", label: "Over 1 uur", at: new Date(Math.ceil((now.getTime() + 3_600_000) / 300_000) * 300_000) }];
  if (now.getHours() < 17) presets.push({ key: "eve", label: "Vanavond 18:00", at: at(0, 18) });
  presets.push({ key: "tom", label: "Morgen 09:00", at: at(1, 9) });
  const untilMonday = ((8 - now.getDay()) % 7) || 7;
  if (untilMonday > 1) presets.push({ key: "mon", label: "Maandag 09:00", at: at(untilMonday, 9) });
  return presets;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
