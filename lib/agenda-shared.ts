// Client-safe rules of the Agenda: categories, states, conflicts, grouping,
// search and the deterministic quick-add parser. No database, no secrets —
// the server (lib/agenda.ts) and the browser share exactly this logic, so
// what the screen warns about is what the server would also say.
import { AMSTERDAM_TZ, getZonedParts } from "@/lib/utils";
import { addDaysISO, diffDaysISO, fold, isValidISODate, minutesOfTime, relativeDayLabel, resolveDateWord, weekdayOfISO } from "@/lib/date-shared";

export const AGENDA_CATEGORIES = ["MEDISCH", "PARAMEDISCH", "FAMILIE", "ACTIVITEIT", "OVERLEG", "VERVOER", "OVERIG"] as const;
export type AgendaCategoryKey = (typeof AGENDA_CATEGORIES)[number];

export const AGENDA_CATEGORY_META: Record<AgendaCategoryKey, { label: string; hint: string; needsEscort: boolean }> = {
  MEDISCH: { label: "Medisch", hint: "Huisarts, specialist, tandarts, ziekenhuis", needsEscort: true },
  PARAMEDISCH: { label: "Paramedisch", hint: "Fysio, ergo, logopedie, diëtist, psycholoog", needsEscort: true },
  FAMILIE: { label: "Familie & bezoek", hint: "Bezoek, uitje met familie, belafspraak", needsEscort: false },
  ACTIVITEIT: { label: "Activiteit", hint: "Uitje, groepsactiviteit, dagbesteding", needsEscort: false },
  OVERLEG: { label: "Overleg", hint: "MDO, zorgplanbespreking, teamoverleg", needsEscort: false },
  VERVOER: { label: "Vervoer", hint: "Rit, taxi, ophalen of wegbrengen", needsEscort: true },
  OVERIG: { label: "Overig", hint: "Alles wat nergens anders past", needsEscort: false },
};

export const AGENDA_STATUSES = ["PLANNED", "DONE", "CANCELLED"] as const;
export type AgendaStatusKey = (typeof AGENDA_STATUSES)[number];
export const AGENDA_STATUS_LABEL: Record<AgendaStatusKey, string> = { PLANNED: "Gepland", DONE: "Afgerond", CANCELLED: "Geannuleerd" };

export type AgendaEventKey = "CREATED" | "EDITED" | "MOVED" | "ASSIGNED" | "UNASSIGNED" | "COMPLETED" | "CANCELLED" | "REOPENED" | "COMMENT";
export const AGENDA_EVENT_LABEL: Record<AgendaEventKey, string> = {
  CREATED: "Aangemaakt",
  EDITED: "Gewijzigd",
  MOVED: "Verplaatst",
  ASSIGNED: "Begeleider gekozen",
  UNASSIGNED: "Begeleider vrijgegeven",
  COMPLETED: "Afgerond",
  CANCELLED: "Geannuleerd",
  REOPENED: "Heropend",
  COMMENT: "Opmerking",
};

export const AGENDA_TITLE_MAX = 200;
export const AGENDA_DESCRIPTION_MAX = 2000;
export const AGENDA_LOCATION_MAX = 200;
export const AGENDA_NOTE_MAX = 1000;
export const AGENDA_COMMENT_MAX = 1000;
/** An afspraak without an end lasts this long wherever a length is needed. */
export const AGENDA_DEFAULT_MINUTES = 60;
/** Reminder lead used when `remindMinutes` is null. */
export const AGENDA_DEFAULT_REMIND_MIN = 5;
/** A planned afspraak with a client in these categories gets a "nog geen begeleider" nudge this many hours ahead. */
export const AGENDA_ESCORT_WARN_HOURS = 72;

/** `value` is minutes before the start; 0 = no reminder; null = the default. */
export const AGENDA_REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "5 minuten ervoor (standaard)" },
  { value: 15, label: "15 minuten ervoor" },
  { value: 30, label: "30 minuten ervoor" },
  { value: 60, label: "1 uur ervoor" },
  { value: 120, label: "2 uur ervoor" },
  { value: 1440, label: "1 dag ervoor" },
  { value: 0, label: "Geen herinnering" },
];

export type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: AgendaCategoryKey | null;
  status: AgendaStatusKey;
  outcome: string | null;
  allDay: boolean;
  startAt: string;
  endAt: string | null;
  clientId: string | null;
  clientName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByName: string;
  seriesId: string | null;
  remindMinutes: number | null;
  /** Hash of the editable content; a stale edit is refused with 409. */
  version: string;
};

export type AgendaEventView = {
  id: string;
  type: AgendaEventKey;
  comment: string | null;
  userName: string;
  createdAt: string;
};

export type AgendaClientOption = { id: string; name: string };
export type AgendaStaffOption = { id: string; name: string };

// --- Time ---------------------------------------------------------------------

const DAY_MS = 86_400_000;

export const startMs = (item: Pick<AgendaItem, "startAt">) => new Date(item.startAt).getTime();

/** End of the afspraak in ms; a missing end is the default length. */
export function endMs(item: Pick<AgendaItem, "startAt" | "endAt" | "allDay">): number {
  const start = new Date(item.startAt).getTime();
  if (item.endAt) return new Date(item.endAt).getTime();
  return start + (item.allDay ? DAY_MS : AGENDA_DEFAULT_MINUTES * 60_000);
}

/** Amsterdam calendar day ("yyyy-mm-dd") of an instant. */
export function ymdOfInstant(value: Date | string | number): string {
  const p = getZonedParts(new Date(value), AMSTERDAM_TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function minutesOfInstant(value: Date | string | number): number {
  const p = getZonedParts(new Date(value), AMSTERDAM_TZ);
  return p.hour * 60 + p.minute;
}

export const fmtHM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "09:30 – 10:15", "09:30" or "Hele dag". */
export function formatAgendaTime(item: Pick<AgendaItem, "startAt" | "endAt" | "allDay">): string {
  if (item.allDay) return "Hele dag";
  const start = fmtHM(minutesOfInstant(item.startAt));
  return item.endAt ? `${start} – ${fmtHM(minutesOfInstant(item.endAt))}` : start;
}

/** The days (Amsterdam) an afspraak touches; an end exactly at midnight does not spill into the next day. */
export function daysOf(item: Pick<AgendaItem, "startAt" | "endAt" | "allDay">, maxDays = 31): string[] {
  const first = ymdOfInstant(item.startAt);
  const last = ymdOfInstant(Math.max(startMs(item), endMs(item) - 1));
  const out: string[] = [];
  for (let day = first; day <= last && out.length < maxDays; day = addDaysISO(day, 1)) out.push(day);
  return out;
}

// --- State ---------------------------------------------------------------------

export type AgendaState = "cancelled" | "done" | "ongoing" | "upcoming" | "to-finish" | "past";

/** Closing the loop (an outcome) matters for care afspraken and anything about a cliënt; a team meeting that is over is simply over. */
export function needsClosure(item: Pick<AgendaItem, "clientId" | "category">): boolean {
  return Boolean(item.clientId) || item.category === "MEDISCH" || item.category === "PARAMEDISCH" || item.category === "VERVOER";
}

/**
 * cancelled/done: as recorded. A planned afspraak is "ongoing" between its
 * start and end; once it is over it is "to-finish" when nobody has closed it
 * yet and closing matters (see needsClosure), else just "past"; before the
 * start it is "upcoming".
 */
export function agendaState(item: Pick<AgendaItem, "status" | "startAt" | "endAt" | "allDay" | "clientId" | "category">, nowMs: number = Date.now()): AgendaState {
  if (item.status === "CANCELLED") return "cancelled";
  if (item.status === "DONE") return "done";
  if (nowMs >= endMs(item)) return needsClosure(item) ? "to-finish" : "past";
  if (nowMs >= startMs(item)) return "ongoing";
  return "upcoming";
}

/** Planned medical/paramedical/transport afspraak for a client that nobody goes along to, within the next 72 hours. */
export function needsEscort(item: AgendaItem, nowMs: number = Date.now()): boolean {
  if (item.status !== "PLANNED" || item.assigneeId || !item.clientId || item.allDay || !item.category) return false;
  if (!AGENDA_CATEGORY_META[item.category].needsEscort) return false;
  const start = startMs(item);
  return start > nowMs && start <= nowMs + AGENDA_ESCORT_WARN_HOURS * 3_600_000;
}

export function compareAgenda(a: AgendaItem, b: AgendaItem): number {
  return Number(b.allDay) - Number(a.allDay) || startMs(a) - startMs(b) || endMs(a) - endMs(b) || a.title.localeCompare(b.title, "nl");
}

export type AgendaSummary = { today: number; ongoing: number; toFinish: number; needsEscort: number; mine: number };

export function summarizeAgenda(items: AgendaItem[], viewerId: string, nowMs: number = Date.now()): AgendaSummary {
  const today = ymdOfInstant(nowMs);
  const s: AgendaSummary = { today: 0, ongoing: 0, toFinish: 0, needsEscort: 0, mine: 0 };
  for (const item of items) {
    if (item.status === "CANCELLED") continue;
    const state = agendaState(item, nowMs);
    if (daysOf(item).includes(today)) s.today++;
    if (state === "ongoing") s.ongoing++;
    if (state === "to-finish") s.toFinish++;
    if (needsEscort(item, nowMs)) s.needsEscort++;
    if (item.assigneeId === viewerId && state !== "done" && state !== "to-finish" && state !== "past") s.mine++;
  }
  return s;
}

// --- Conflicts -------------------------------------------------------------------

export type AgendaConflict = { id: string; title: string; startAt: string; endAt: string | null; allDay: boolean; reason: "client" | "assignee" };

/**
 * Overlaps worth a warning: the same cliënt in two places at once, or the same
 * begeleider on two afspraken. Cancelled ones don't count. It is a warning, not
 * a block: a group activity or a shared lift is legitimate.
 */
export function findConflicts(
  candidate: { id?: string; clientId: string | null; assigneeId: string | null; startAt: string; endAt: string | null; allDay: boolean },
  others: AgendaItem[]
): AgendaConflict[] {
  const cs = new Date(candidate.startAt).getTime();
  const ce = endMs(candidate);
  const out: AgendaConflict[] = [];
  for (const o of others) {
    if (o.id === candidate.id || o.status === "CANCELLED") continue;
    if (!(startMs(o) < ce && cs < endMs(o))) continue;
    const reason = candidate.clientId && o.clientId === candidate.clientId ? "client" : candidate.assigneeId && o.assigneeId === candidate.assigneeId ? "assignee" : null;
    if (reason) out.push({ id: o.id, title: o.title, startAt: o.startAt, endAt: o.endAt, allDay: o.allDay, reason });
  }
  return out;
}

// --- Grouping ---------------------------------------------------------------------

export type AgendaDay = { ymd: string; label: string; items: AgendaItem[] };

const WEEKDAY_LONG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MONTH_LONG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** "Vandaag · donderdag 22 oktober" / "Morgen · vrijdag 23 oktober" / "zaterdag 24 oktober". */
export function dayHeading(ymd: string, todayYmd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = `${WEEKDAY_LONG[weekdayOfISO(ymd)]} ${d} ${MONTH_LONG[m - 1]}${y !== Number(todayYmd.slice(0, 4)) ? ` ${y}` : ""}`;
  const diff = diffDaysISO(ymd, todayYmd);
  if (diff === 0) return `Vandaag · ${base}`;
  if (diff === 1) return `Morgen · ${base}`;
  if (diff === -1) return `Gisteren · ${base}`;
  return base;
}

/** Items per Amsterdam day (a multi-day afspraak appears on each day), days ascending. Only days that have items. */
export function groupByDay(items: AgendaItem[], todayYmd: string, from?: string, to?: string): AgendaDay[] {
  const map = new Map<string, AgendaItem[]>();
  for (const item of [...items].sort(compareAgenda)) {
    for (const ymd of daysOf(item)) {
      if ((from && ymd < from) || (to && ymd > to)) continue;
      const list = map.get(ymd);
      if (list) list.push(item);
      else map.set(ymd, [item]);
    }
  }
  return [...map.keys()].sort().map((ymd) => ({ ymd, label: dayHeading(ymd, todayYmd), items: map.get(ymd)! }));
}

// --- Search and filters --------------------------------------------------------------

export type AgendaFilters = {
  query: string;
  mine: boolean;
  needsEscort: boolean;
  toFinish: boolean;
  category: AgendaCategoryKey | "";
  clientId: string;
  showCancelled: boolean;
};

export const EMPTY_FILTERS: AgendaFilters = { query: "", mine: false, needsEscort: false, toFinish: false, category: "", clientId: "", showCancelled: false };

export function activeFilterCount(f: AgendaFilters): number {
  return [f.mine, f.needsEscort, f.toFinish, f.category !== "", f.clientId !== "", f.showCancelled].filter(Boolean).length;
}

/** Case- and accent-insensitive "all words must match" over what is visible on the card. */
export function matchesAgendaSearch(item: AgendaItem, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(
    [item.title, item.description ?? "", item.location ?? "", item.clientName ?? "", item.assigneeName ?? "", item.category ? AGENDA_CATEGORY_META[item.category].label : ""].join(" ")
  );
  return words.every((w) => haystack.includes(w));
}

export function applyFilters(items: AgendaItem[], f: AgendaFilters, viewerId: string, nowMs: number = Date.now()): AgendaItem[] {
  return items.filter((i) => {
    if (i.status === "CANCELLED" && !f.showCancelled) return false;
    if (f.mine && i.assigneeId !== viewerId) return false;
    if (f.needsEscort && !needsEscort(i, nowMs)) return false;
    if (f.toFinish && agendaState(i, nowMs) !== "to-finish") return false;
    if (f.category && i.category !== f.category) return false;
    if (f.clientId && i.clientId !== f.clientId) return false;
    return matchesAgendaSearch(i, f.query);
  });
}

// --- Quick add ----------------------------------------------------------------------

export type AgendaQuickAddResult = {
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  durationMin: number | null;
  allDay: boolean;
  category: AgendaCategoryKey | null;
  clientId: string | null;
  /** "me" for +ik, otherwise a staff id. */
  assigneeId: string | null;
  chips: { kind: "date" | "time" | "duration" | "allday" | "category" | "client" | "assignee"; label: string }[];
};

const CATEGORY_ALIASES: Record<string, AgendaCategoryKey> = {
  arts: "MEDISCH", huisarts: "MEDISCH", tandarts: "MEDISCH", specialist: "MEDISCH", fysio: "PARAMEDISCH", ergo: "PARAMEDISCH", bezoek: "FAMILIE", mdo: "OVERLEG", taxi: "VERVOER", rit: "VERVOER",
};

function resolveCategory(prefix: string): AgendaCategoryKey | null {
  if (prefix in CATEGORY_ALIASES) return CATEGORY_ALIASES[prefix];
  const hits = AGENDA_CATEGORIES.filter((c) => fold(AGENDA_CATEGORY_META[c].label).startsWith(prefix));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * One-line "Snel toevoegen". Understands
 *   14:00 / 14.30 / om 9 uur        → start time
 *   14:00-15:30 / tot 15:30 / 45min / 1u / 1,5u  → end or length
 *   vandaag, morgen, vrijdag, 12-3  → date
 *   hele dag                        → all-day
 *   #medisch #fysio #bezoek         → category
 *   @jan                            → client (only when unambiguous)
 *   +ik / +els                      → begeleider (only when unambiguous)
 * Everything else is the title. No network.
 */
export function parseAgendaQuickAdd(
  input: string,
  todayISO: string,
  clients: AgendaClientOption[] = [],
  staff: AgendaStaffOption[] = []
): AgendaQuickAddResult {
  const chips: AgendaQuickAddResult["chips"] = [];
  const r: AgendaQuickAddResult = { title: "", date: null, time: null, endTime: null, durationMin: null, allDay: false, category: null, clientId: null, assigneeId: null, chips };
  const words = input.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  const hm = (h: string, m: string) => `${h.padStart(2, "0")}:${m}`;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    const lower = fold(word).replace(/[.,;]$/, "");

    // 14:00-15:30
    let m = word.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)[-–]([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (m && !r.time) {
      r.time = hm(m[1], m[2]);
      r.endTime = hm(m[3], m[4]);
      chips.push({ kind: "time", label: `${r.time}–${r.endTime}` });
      if (kept.length && fold(kept[kept.length - 1]) === "om") kept.pop();
      continue;
    }
    // 14:00, 9.30
    m = word.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (m && !r.time) {
      r.time = hm(m[1], m[2]);
      chips.push({ kind: "time", label: r.time });
      if (kept.length && fold(kept[kept.length - 1]) === "om") kept.pop();
      continue;
    }
    // om 9 [uur]
    if (lower === "om" && next && !r.time) {
      const h = next.match(/^([01]?\d|2[0-3])$/);
      if (h) {
        r.time = hm(h[1], "00");
        chips.push({ kind: "time", label: r.time });
        i += fold(words[i + 2] ?? "") === "uur" ? 2 : 1;
        continue;
      }
    }
    // tot 15:30
    if (lower === "tot" && next && !r.endTime) {
      const t = next.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
      if (t) {
        r.endTime = hm(t[1], t[2]);
        chips.push({ kind: "time", label: `tot ${r.endTime}` });
        i += 1;
        continue;
      }
    }
    // 45min / 1u / 1,5u
    m = lower.match(/^(\d{1,3})(?:min|m)$/);
    if (m && r.durationMin === null) {
      r.durationMin = Number(m[1]);
      chips.push({ kind: "duration", label: `${r.durationMin} min` });
      continue;
    }
    m = lower.match(/^(\d)(?:[.,]([05]))?(?:u|uur)$/);
    if (m && r.durationMin === null) {
      r.durationMin = Number(m[1]) * 60 + (m[2] === "5" ? 30 : 0);
      chips.push({ kind: "duration", label: `${m[1]}${m[2] ? `,${m[2]}` : ""} uur` });
      continue;
    }
    // hele dag
    if ((lower === "hele" && fold(next ?? "") === "dag") || lower === "heledag") {
      r.allDay = true;
      chips.push({ kind: "allday", label: "Hele dag" });
      if (lower === "hele") i += 1;
      continue;
    }
    // #category
    if (word.startsWith("#") && word.length > 1 && !r.category) {
      const cat = resolveCategory(fold(word.slice(1)));
      if (cat) {
        r.category = cat;
        chips.push({ kind: "category", label: AGENDA_CATEGORY_META[cat].label });
        continue;
      }
    }
    // @client
    if (word.startsWith("@") && word.length > 1 && !r.clientId) {
      const prefix = fold(word.slice(1));
      const hits = clients.filter((c) => fold(c.name).split(/\s+/).some((part) => part.startsWith(prefix)));
      if (hits.length === 1) {
        r.clientId = hits[0].id;
        chips.push({ kind: "client", label: hits[0].name });
        continue;
      }
    }
    // +begeleider
    if (word.startsWith("+") && word.length > 1 && !r.assigneeId) {
      const prefix = fold(word.slice(1));
      if (prefix === "ik") {
        r.assigneeId = "me";
        chips.push({ kind: "assignee", label: "Ik" });
        continue;
      }
      const hits = staff.filter((s) => fold(s.name).split(/\s+/).some((part) => part.startsWith(prefix)));
      if (hits.length === 1) {
        r.assigneeId = hits[0].id;
        chips.push({ kind: "assignee", label: hits[0].name });
        continue;
      }
    }
    // date
    if (!r.date) {
      const date = resolveDateWord(word.replace(/[.,;]$/, ""), todayISO);
      if (date) {
        r.date = date;
        chips.push({ kind: "date", label: relativeDayLabel(date, todayISO) });
        continue;
      }
    }
    kept.push(word);
  }

  r.title = kept.join(" ").trim().slice(0, AGENDA_TITLE_MAX);
  if (r.endTime && r.time && (minutesOfTime(r.endTime) ?? 0) <= (minutesOfTime(r.time) ?? 0)) r.endTime = null; // end before start: ignore, don't guess
  return r;
}

/** "YYYY-MM-DDTHH:mm" strings for a parsed entry, or null when there is no date/time to start from. */
export function quickAddToLocal(r: Pick<AgendaQuickAddResult, "date" | "time" | "endTime" | "durationMin" | "allDay">, todayISO: string): { startAt: string; endAt: string } | null {
  const date = r.date ?? todayISO;
  if (r.allDay) return { startAt: `${date}T00:00`, endAt: "" };
  if (!r.time) return null;
  let endAt = "";
  if (r.endTime) endAt = `${date}T${r.endTime}`;
  else if (r.durationMin) {
    const total = (minutesOfTime(r.time) ?? 0) + r.durationMin;
    const endDate = total >= 24 * 60 ? addDaysISO(date, 1) : date;
    endAt = `${endDate}T${fmtHM(total % (24 * 60))}`;
  }
  return { startAt: `${date}T${r.time}`, endAt };
}

export { isValidISODate };

// --- Visible range ---------------------------------------------------------------------

export type AgendaViewKey = "lijst" | "dag" | "week" | "maand";

/** [from, to) in Amsterdam calendar days of what a view loads. The list also looks 14 days back for what is still to finish. */
export function agendaRange(view: AgendaViewKey, anchor: string, today: string, listDays = 14): { from: string; to: string } {
  const monday = (ymd: string) => addDaysISO(ymd, -weekdayOfISO(ymd));
  if (view === "lijst") return { from: addDaysISO(today, -14), to: addDaysISO(today, listDays + 1) };
  if (view === "dag") return { from: anchor, to: addDaysISO(anchor, 1) };
  if (view === "week") return { from: monday(anchor), to: addDaysISO(monday(anchor), 7) };
  const first = `${anchor.slice(0, 8)}01`;
  return { from: monday(first), to: addDaysISO(monday(first), 42) };
}
