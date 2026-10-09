// Expands an agenda "herhaling" into concrete calendar dates. Pure (no
// DB, no timezone work): works on plain "YYYY-MM-DD" strings so the caller
// can pair each date with the same Amsterdam wall-clock time via
// parseDatetimeLocalAsAmsterdam — which keeps a 09:00 afspraak at 09:00
// across the DST switch, something adding 7×24h would get wrong.
//
// Why materialised rows rather than an RRULE: every occurrence stays an
// ordinary Appointment (own reminder, own edit, own iCal event) and
// "this / this and following / all" is just a query on seriesId.

export type RepeatRule =
  | { mode: "none" }
  | {
      mode: "daily" | "weekly" | "biweekly" | "monthly";
      /** ISO weekdays, 1 = Monday … 7 = Sunday. Only used by weekly/biweekly; defaults to the first date's weekday. */
      weekdays?: number[];
      /** Last allowed date (inclusive), "YYYY-MM-DD". */
      until?: string;
      /** Total number of occurrences including the first. */
      count?: number;
    }
  | { mode: "dates"; dates: string[] };

export const MAX_OCCURRENCES = 120;
const MAX_HORIZON_DAYS = 800;
const DAY_MS = 86_400_000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(value: string): number | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // Reject 2026-02-31 style overflow.
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}

export function formatYmd(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isoWeekday(t: number): number {
  const d = new Date(t).getUTCDay();
  return d === 0 ? 7 : d;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * All occurrence dates (sorted, unique, always including `firstDate`) for a rule.
 * Throws RangeError for an unparseable date or when the rule would produce
 * nothing bounded (no `until` and no `count` on a repeating mode).
 */
export function expandOccurrenceDates(firstDate: string, rule: RepeatRule): string[] {
  const first = parseYmd(firstDate);
  if (first === null) throw new RangeError("Ongeldige begindatum");

  if (rule.mode === "none") return [firstDate];

  if (rule.mode === "dates") {
    const all = new Set<number>([first]);
    for (const d of rule.dates) {
      const t = parseYmd(d);
      if (t === null) throw new RangeError(`Ongeldige datum: ${d}`);
      all.add(t);
    }
    const sorted = [...all].sort((a, b) => a - b);
    if (sorted.length > MAX_OCCURRENCES) throw new RangeError(`Maximaal ${MAX_OCCURRENCES} datums`);
    return sorted.map(formatYmd);
  }

  const until = rule.until ? parseYmd(rule.until) : null;
  if (rule.until && until === null) throw new RangeError("Ongeldige einddatum");
  if (until === null && !rule.count) throw new RangeError("Kies een einddatum of aantal keer");
  if (until !== null && until < first) throw new RangeError("Einddatum ligt voor de eerste afspraak");

  const limit = Math.min(rule.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const horizon = Math.min(until ?? Infinity, first + MAX_HORIZON_DAYS * DAY_MS);
  const out: number[] = [];

  if (rule.mode === "monthly") {
    const f = new Date(first);
    const wantedDay = f.getUTCDate();
    for (let i = 0; out.length < limit; i++) {
      const y = f.getUTCFullYear() + Math.floor((f.getUTCMonth() + i) / 12);
      const m = (f.getUTCMonth() + i) % 12;
      // 31st → last day of shorter months, instead of silently skipping them.
      const t = Date.UTC(y, m, Math.min(wantedDay, daysInMonth(y, m)));
      if (t > horizon) break;
      out.push(t);
    }
    return out.map(formatYmd);
  }

  const weekdays = new Set(rule.mode === "daily" ? [] : rule.weekdays?.length ? rule.weekdays : [isoWeekday(first)]);
  for (const w of weekdays) {
    if (!Number.isInteger(w) || w < 1 || w > 7) throw new RangeError("Ongeldige weekdag");
  }
  const weekStride = rule.mode === "biweekly" ? 2 : 1;
  // Monday of the first date's week anchors the "every other week" cadence.
  const anchorMonday = first - (isoWeekday(first) - 1) * DAY_MS;

  for (let t = first; t <= horizon && out.length < limit; t += DAY_MS) {
    if (rule.mode === "daily") {
      out.push(t);
      continue;
    }
    const weekIndex = Math.floor((t - anchorMonday) / (7 * DAY_MS));
    if (weekIndex % weekStride === 0 && weekdays.has(isoWeekday(t))) out.push(t);
  }
  // A weekly rule whose weekdays all precede the first date's weekday still
  // must contain the date the user actually picked.
  if (!out.includes(first)) {
    out.push(first);
    out.sort((a, b) => a - b);
    if (out.length > limit) out.pop();
  }
  return out.map(formatYmd);
}

/** "2026-10-07T09:00" → "2026-10-07" */
export function datePartOfLocal(value: string): string {
  return value.slice(0, 10);
}

/** "2026-10-07T09:00" → "09:00" */
export function timePartOfLocal(value: string): string {
  return value.slice(11, 16);
}
