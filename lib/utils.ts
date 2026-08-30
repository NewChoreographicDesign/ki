import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ShiftType } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Parses a "DD-MM-JJJJ" string into a UTC Date at midnight. Returns null when malformed.
export function parseDDMMYYYY(input: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDDMMYYYY(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

// --- Timezone (Europe/Amsterdam) --------------------------------------------
// Vercel's serverless functions run in UTC regardless of where the woongroep
// actually is, so every "wall clock" concept in this app (shift boundaries,
// "today", the weekly rapportage reset) has to explicitly convert through
// Europe/Amsterdam rather than relying on the server's local time — otherwise
// shift windows and day boundaries silently drift by 1-2 hours (DST-dependent).

const AMSTERDAM_TZ = "Europe/Amsterdam";

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Converts a specific Europe/Amsterdam wall-clock time to its UTC instant (DST-aware). */
export function amsterdamDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  // Two correction passes converge reliably (the offset only takes two
  // values, +1h/+2h, and this is never called near the DST-switch instant).
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 2; i++) {
    const p = getZonedParts(new Date(guess), AMSTERDAM_TZ);
    const guessedWallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess -= guessedWallAsUtc - Date.UTC(year, month - 1, day, hour, minute, second);
  }
  return new Date(guess);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: AMSTERDAM_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: AMSTERDAM_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: AMSTERDAM_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Midnight today in Europe/Amsterdam, as a UTC instant. */
export function startOfToday(): Date {
  const p = getZonedParts(new Date(), AMSTERDAM_TZ);
  return amsterdamDate(p.year, p.month, p.day);
}

/** Midnight of the most recent Thursday (Amsterdam calendar; today counts if it's Thursday). */
export function mostRecentThursdayStart(now: Date = new Date()): Date {
  const p = getZonedParts(now, AMSTERDAM_TZ);
  // Use UTC noon (not midnight) purely to compute the weekday number safely,
  // away from any DST-transition edge case.
  const noonUtc = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  const weekday = noonUtc.getUTCDay(); // 0=Sun .. 6=Sat
  const daysSinceThursday = (weekday - 4 + 7) % 7; // Thursday = 4
  const thursdayNoonUtc = new Date(noonUtc.getTime() - daysSinceThursday * 86_400_000);
  return amsterdamDate(
    thursdayNoonUtc.getUTCFullYear(),
    thursdayNoonUtc.getUTCMonth() + 1,
    thursdayNoonUtc.getUTCDate()
  );
}

export function fullName(client: { firstName: string; lastName: string }): string {
  return `${client.firstName} ${client.lastName}`;
}

// --- Shift logic -----------------------------------------------------------
// Morning shift: 07:00-15:00. Evening shift: 14:00-23:00 (overlaps 14:00-15:00).
// Outside those windows (23:00-07:00) we attach the login to the nearest shift.
// All wall-clock times below are Europe/Amsterdam, not the server's local time.

export function determineShiftType(date: Date = new Date()): ShiftType {
  const hour = getZonedParts(date, AMSTERDAM_TZ).hour;
  if (hour >= 7 && hour < 15) return ShiftType.MORNING;
  if (hour >= 15 && hour < 23) return ShiftType.EVENING;
  // Night hours (23:00-07:00): treat as a continuation of the evening shift.
  return ShiftType.EVENING;
}

export function shiftEndForStart(type: ShiftType, startedAt: Date): Date {
  const p = getZonedParts(startedAt, AMSTERDAM_TZ);
  const endHour = type === ShiftType.MORNING ? 15 : 23;
  let end = amsterdamDate(p.year, p.month, p.day, endHour);
  if (end <= startedAt) {
    const nextDay = new Date(amsterdamDate(p.year, p.month, p.day, 12).getTime() + 24 * 3_600_000);
    const p2 = getZonedParts(nextDay, AMSTERDAM_TZ);
    end = amsterdamDate(p2.year, p2.month, p2.day, endHour);
  }
  return end;
}
