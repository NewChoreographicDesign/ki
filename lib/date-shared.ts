// Generic, client-safe date/text helpers shared by the Agenda's quick-add
// parser (and anything else that later wants the same "vandaag/morgen/
// vrijdag" date-word resolution or accent-insensitive search). No
// "server-only", no Prisma — pure functions only.

import { AMSTERDAM_TZ, getZonedParts } from "@/lib/utils";

/** Wall-clock "now" in Amsterdam: calendar date ("yyyy-mm-dd"), weekday (0 = Monday) and minutes since midnight. */
export function amsterdamNow(nowMs: number = Date.now()): { dateISO: string; weekday: number; minutes: number } {
  const p = getZonedParts(new Date(nowMs), AMSTERDAM_TZ);
  const dateISO = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { dateISO, weekday: weekdayOfISO(dateISO), minutes: p.hour * 60 + p.minute };
}

export function weekdayOfISO(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return (d + 6) % 7;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDaysISO(a: string, b: string): number {
  return Math.round((new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86_400_000);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function minutesOfTime(time: string | null): number | null {
  const m = time?.match(/^(\d{2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const WEEKDAY_NAMES = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MONTH_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "vandaag" / "morgen" / "vrijdag" / "12 mrt" — for chips and headings. */
export function relativeDayLabel(iso: string, todayISO: string): string {
  const diff = diffDaysISO(iso, todayISO);
  if (diff === 0) return "vandaag";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gisteren";
  if (diff > 1 && diff < 7) return WEEKDAY_NAMES[weekdayOfISO(iso)];
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]}`;
}

export function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const DAY_ALIASES: Record<string, number> = {
  maandag: 0, ma: 0, dinsdag: 1, di: 1, woensdag: 2, wo: 2, donderdag: 3, do: 3, vrijdag: 4, vr: 4, zaterdag: 5, za: 5, zondag: 6, zo: 6,
};

/** Date word → ISO date, or null. Weekday names resolve to the NEXT such day (never today). */
export function resolveDateWord(word: string, todayISO: string): string | null {
  const w = fold(word);
  if (w === "vandaag") return todayISO;
  if (w === "morgen") return addDaysISO(todayISO, 1);
  if (w === "overmorgen") return addDaysISO(todayISO, 2);
  if (w in DAY_ALIASES) {
    const delta = ((DAY_ALIASES[w] - weekdayOfISO(todayISO) + 7) % 7) || 7;
    return addDaysISO(todayISO, delta);
  }
  const m = w.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const [ty] = todayISO.split("-").map(Number);
    let year = m[3] ? Number(m[3]) : ty;
    if (year < 100) year += 2000;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isValidISODate(iso)) return null;
    // "5-3" typed in December means next March.
    return !m[3] && iso < todayISO ? `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : iso;
  }
  return null;
}
