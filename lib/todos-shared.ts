// Client-safe half of the Werklijst: categories, limits, the pure rules (which
// bucket a task belongs in, what counts as "te laat", ordering, summary) and
// the deterministic quick-add parser. Deliberately no "server-only" and no
// Prisma runtime import — database access lives in lib/todos.ts. Generic
// date/text helpers (amsterdamNow, addDaysISO, resolveDateWord, fold, ...)
// live in lib/date-shared.ts and are re-used here, not duplicated.

import { amsterdamDate, isTodoDueToday } from "@/lib/utils";
import { addDaysISO, amsterdamNow, diffDaysISO, fold, formatDayShort, isValidISODate, minutesOfTime, relativeDayLabel, resolveDateWord, weekdayOfISO } from "@/lib/date-shared";

export { addDaysISO, amsterdamNow, diffDaysISO, fold, formatDayShort, isValidISODate, minutesOfTime, relativeDayLabel, resolveDateWord, weekdayOfISO };

export const TODO_CATEGORIES = ["ZORG", "MEDICATIE", "HUISHOUDING", "ADMINISTRATIE", "AFSPRAAK", "OVERIG"] as const;
export type TodoCategoryKey = (typeof TODO_CATEGORIES)[number];

export const TODO_CATEGORY_META: Record<TodoCategoryKey, { label: string; hint: string }> = {
  ZORG: { label: "Zorg", hint: "Persoonlijke verzorging, begeleiding, observatie" },
  MEDICATIE: { label: "Medicatie", hint: "Klaarzetten, controleren, bestellen" },
  HUISHOUDING: { label: "Huishouding", hint: "Schoonmaak, boodschappen, maaltijden" },
  ADMINISTRATIE: { label: "Administratie", hint: "Rapportage, plannen, formulieren" },
  AFSPRAAK: { label: "Afspraak", hint: "Afspraken, vervoer, bezoek" },
  OVERIG: { label: "Overig", hint: "Alles wat nergens anders past" },
};

export type TodoPriorityKey = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export const TODO_PRIORITY_RANK: Record<TodoPriorityKey, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
export const TODO_PRIORITY_LABEL: Record<TodoPriorityKey, string> = { NONE: "Geen", LOW: "Laag", MEDIUM: "Gemiddeld", HIGH: "Hoog" };

export const TODO_TITLE_MAX = 300;
export const TODO_DESCRIPTION_MAX = 2000;
export const TODO_NOTE_MAX = 1000;
export const TODO_COMMENT_MAX = 1000;
export const TODO_CHECKLIST_MAX = 30;
export const TODO_CHECKLIST_TEXT_MAX = 200;
/** Snoozing further than this is "forgetting", not postponing. */
export const TODO_SNOOZE_MAX_DAYS = 14;
export const TODO_BULK_MAX = 100;
/** A timed task is "te laat" once it is this long past its time. */
export const TODO_LATE_GRACE_MIN = 15;
/** How long finished tasks stay on the board's "Afgerond" tab. */
export const TODO_RECENT_DONE_DAYS = 7;

export type ChecklistItem = { id: string; text: string; done: boolean };

export type TodoEventKey = "CREATED" | "EDITED" | "COMPLETED" | "REOPENED" | "CLAIMED" | "RELEASED" | "SNOOZED" | "UNSNOOZED" | "COMMENT";

export const TODO_EVENT_LABEL: Record<TodoEventKey, string> = {
  CREATED: "heeft de taak aangemaakt",
  EDITED: "heeft de taak gewijzigd",
  COMPLETED: "heeft de taak afgerond",
  REOPENED: "heeft de taak heropend",
  CLAIMED: "pakt dit op",
  RELEASED: "geeft dit weer vrij",
  SNOOZED: "heeft de taak uitgesteld",
  UNSNOOZED: "heeft het uitstel opgeheven",
  COMMENT: "reageerde",
};

export type TodoEventView = {
  id: string;
  type: TodoEventKey;
  comment: string;
  byName: string;
  at: string;
};

/** The subset of a task the pure rules below need (TodoData satisfies it). */
export type TodoRuleInput = {
  completed: boolean;
  daysOfWeek: number[];
  intervalDays: number | null;
  intervalAnchorDate: string | null;
  showUntil: string | null;
  dueDate: string | null;
  snoozedUntil: string | null;
  time: string | null;
  priority: TodoPriorityKey;
  createdAt: string;
};

/** A task as the browser sees it. */
export type TodoData = {
  id: string;
  title: string;
  description: string | null;
  priority: TodoPriorityKey;
  daysOfWeek: number[];
  intervalDays: number | null;
  intervalAnchorDate: string | null;
  showUntil: string | null;
  /** One-off deadline, "yyyy-mm-dd..." (UTC-midnight ISO). Not combined with `recurring`. */
  dueDate: string | null;
  interventionPlanId: string | null;
  time: string | null;
  recurring: boolean;
  completed: boolean;
  completedByName: string | null;
  completedAt: string | null;
  completionNote: string | null;
  createdByName: string;
  createdById: string;
  createdAt: string;
  /** Null = shared team task on the Werklijst; set = personal task for that medewerker. */
  assignedToId: string | null;
  assignedToName: string | null;
  /** Null/empty = "Algemeen". Only meaningful for personal tasks. */
  room: string | null;
  category: TodoCategoryKey | null;
  clientId: string | null;
  clientName: string | null;
  claimedById: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  snoozedUntil: string | null;
  checklist: ChecklistItem[];
  /** Token of the editable content; sent back as `since` so a stale edit gets a 409 instead of overwriting a colleague. */
  version: string;
};

export type TodoClientOption = { id: string; name: string; room: string | null };

export type TodoBucket = "overdue" | "today" | "upcoming" | "snoozed" | "hidden" | "done";

// --- Buckets and lateness --------------------------------------------------

/**
 * Which list an OPEN or finished task belongs on right now.
 *  - overdue: a one-off due date in the past
 *  - today:   due today (one-off date, today's weekday/interval, or no schedule at all)
 *  - upcoming: scheduled for a later day
 *  - snoozed: postponed until later
 *  - hidden:  past its `showUntil` (an intervention-plan task whose plan is up for evaluation)
 */
export function todoBucket(todo: TodoRuleInput, nowMs: number = Date.now()): TodoBucket {
  if (todo.completed) return "done";
  const now = amsterdamNow(nowMs);
  if (todo.showUntil && now.dateISO > todo.showUntil.slice(0, 10)) return "hidden";
  if (todo.snoozedUntil && new Date(todo.snoozedUntil).getTime() > nowMs) return "snoozed";
  if (todo.dueDate) {
    const due = todo.dueDate.slice(0, 10);
    if (due < now.dateISO) return "overdue";
    return due === now.dateISO ? "today" : "upcoming";
  }
  const todayDate = new Date(`${now.dateISO}T00:00:00Z`);
  return isTodoDueToday(todo, todayDate, now.weekday) ? "today" : "upcoming";
}

/** Whole days past the due date (0 when not overdue by date). */
export function daysOverdue(todo: Pick<TodoRuleInput, "dueDate" | "completed">, nowMs: number = Date.now()): number {
  if (todo.completed || !todo.dueDate) return 0;
  return Math.max(0, diffDaysISO(amsterdamNow(nowMs).dateISO, todo.dueDate.slice(0, 10)));
}

/** "Te laat": overdue by date, or due today with a time that is more than the grace period behind us. */
export function isLate(todo: TodoRuleInput, nowMs: number = Date.now()): boolean {
  const bucket = todoBucket(todo, nowMs);
  if (bucket === "overdue") return true;
  if (bucket !== "today") return false;
  const at = minutesOfTime(todo.time);
  return at !== null && amsterdamNow(nowMs).minutes > at + TODO_LATE_GRACE_MIN;
}

/** Ordering inside a list: timed first (earliest first), then priority, then oldest. */
export function compareTodos(a: TodoRuleInput, b: TodoRuleInput): number {
  if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  const byPriority = TODO_PRIORITY_RANK[a.priority] - TODO_PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  return a.createdAt.localeCompare(b.createdAt);
}

/** The "Te laat" list: the longest overdue first, then the usual order. */
export function compareOverdue(a: TodoRuleInput, b: TodoRuleInput): number {
  return (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || compareTodos(a, b);
}

/**
 * The next calendar day (after today) a not-yet-due task comes up, looking at
 * most two weeks ahead; null when it is further away than that. A one-off
 * date is simply that date.
 */
export function nextOccurrence(todo: TodoRuleInput, nowMs: number = Date.now()): string | null {
  const today = amsterdamNow(nowMs).dateISO;
  if (todo.dueDate) return todo.dueDate.slice(0, 10);
  for (let i = 1; i <= 14; i++) {
    const iso = addDaysISO(today, i);
    if (todo.showUntil && iso > todo.showUntil.slice(0, 10)) return null;
    if (isTodoDueToday(todo, new Date(`${iso}T00:00:00Z`), weekdayOfISO(iso))) return iso;
  }
  return null;
}

export type TodoPartOfDay = "late" | "morning" | "afternoon" | "evening" | "anytime";
export const PART_OF_DAY_LABEL: Record<TodoPartOfDay, string> = {
  late: "Te laat",
  morning: "Ochtend",
  afternoon: "Middag",
  evening: "Avond",
  anytime: "Gedurende de dag",
};

export function partOfDay(todo: TodoRuleInput, nowMs: number = Date.now()): TodoPartOfDay {
  if (isLate(todo, nowMs)) return "late";
  const at = minutesOfTime(todo.time);
  if (at === null) return "anytime";
  if (at < 12 * 60) return "morning";
  return at < 18 * 60 ? "afternoon" : "evening";
}

export type TodoSummary = { late: number; today: number; upcoming: number; snoozed: number; doneToday: number; openToday: number };

export function summarizeTodos(open: TodoRuleInput[], completed: (TodoRuleInput & { completedAt: string | null })[], nowMs: number = Date.now()): TodoSummary {
  const s: TodoSummary = { late: 0, today: 0, upcoming: 0, snoozed: 0, doneToday: 0, openToday: 0 };
  for (const t of open) {
    const bucket = todoBucket(t, nowMs);
    if (isLate(t, nowMs)) s.late++;
    if (bucket === "today" || bucket === "overdue") s.today++;
    else if (bucket === "upcoming") s.upcoming++;
    else if (bucket === "snoozed") s.snoozed++;
  }
  const todayISO = amsterdamNow(nowMs).dateISO;
  for (const t of completed) {
    if (t.completedAt && amsterdamNow(new Date(t.completedAt).getTime()).dateISO === todayISO) s.doneToday++;
  }
  s.openToday = s.today;
  return s;
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

// --- Snooze presets (client and server agree on these) -----------------------

export type SnoozePreset = "later" | "tomorrow" | "monday";
export const SNOOZE_LABEL: Record<SnoozePreset, string> = { later: "Over 3 uur", tomorrow: "Morgenochtend", monday: "Maandag" };

/** The moment a preset resolves to, as an ISO instant. Uses Amsterdam wall-clock for "morgenochtend 08:00". */
export function snoozeUntil(preset: SnoozePreset, nowMs: number = Date.now()): string {
  if (preset === "later") return new Date(nowMs + 3 * 60 * 60 * 1000).toISOString();
  const today = amsterdamNow(nowMs);
  const target = preset === "tomorrow" ? addDaysISO(today.dateISO, 1) : addDaysISO(today.dateISO, 7 - today.weekday);
  const [y, m, d] = target.split("-").map(Number);
  return amsterdamDate(y, m, d, 8, 0).toISOString();
}

/** Server-side validation of a requested snooze moment. Returns an error message in Dutch or null. */
export function validateSnooze(until: Date, nowMs: number = Date.now()): string | null {
  if (Number.isNaN(until.getTime())) return "Ongeldig tijdstip";
  if (until.getTime() <= nowMs) return "Het tijdstip ligt in het verleden";
  if (until.getTime() > nowMs + TODO_SNOOZE_MAX_DAYS * 86_400_000) return `Uitstellen kan maximaal ${TODO_SNOOZE_MAX_DAYS} dagen`;
  return null;
}

// --- Quick add -------------------------------------------------------------

export type QuickAddClient = { id: string; name: string };

export type QuickAddResult = {
  title: string;
  time: string | null;
  dueDate: string | null;
  priority: TodoPriorityKey | null;
  category: TodoCategoryKey | null;
  clientId: string | null;
  /** What was recognised, in reading order — shown as chips under the input. */
  chips: { kind: "time" | "date" | "priority" | "category" | "client"; label: string }[];
};

/**
 * Deterministic parser for the one-line "Snel toevoegen" bar. Understands
 *   09:30 / 9.30 / om 9 uur      → time
 *   vandaag, morgen, overmorgen, vrijdag, 12-3 → due date
 *   !hoog !laag !midden !geen (of !!, !)   → priority
 *   #medicatie #zorg …           → category (any unique prefix)
 *   @jan                         → client (unique first-name/name prefix)
 * Everything else is the title. No network, no AI: most entries never need one.
 */
export function parseQuickAdd(input: string, todayISO: string, clients: QuickAddClient[] = []): QuickAddResult {
  const chips: QuickAddResult["chips"] = [];
  const result: QuickAddResult = { title: "", time: null, dueDate: null, priority: null, category: null, clientId: null, chips };
  const words = input.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    const lower = fold(word);

    // time: 09:30, 9.30 — or "om 9" / "om 9 uur"
    let m = word.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (m && !result.time) {
      result.time = `${m[1].padStart(2, "0")}:${m[2]}`;
      chips.push({ kind: "time", label: result.time });
      if (kept.length && fold(kept[kept.length - 1]) === "om") kept.pop();
      continue;
    }
    if (lower === "om" && next && !result.time) {
      const h = next.match(/^([01]?\d|2[0-3])$/);
      if (h) {
        result.time = `${h[1].padStart(2, "0")}:00`;
        chips.push({ kind: "time", label: result.time });
        i += fold(words[i + 2] ?? "") === "uur" ? 2 : 1;
        continue;
      }
    }

    // priority
    m = lower.match(/^!(hoog|h|laag|l|midden|gemiddeld|m|geen|g|!)?$/);
    if (m && !result.priority) {
      const key = m[1] ?? "h";
      result.priority = key.startsWith("h") || key === "!" ? "HIGH" : key.startsWith("l") ? "LOW" : key.startsWith("g") && key !== "gemiddeld" ? "NONE" : "MEDIUM";
      chips.push({ kind: "priority", label: TODO_PRIORITY_LABEL[result.priority] });
      continue;
    }

    // category: #med → MEDICATIE (only when the prefix is unambiguous)
    if (word.startsWith("#") && word.length > 1 && !result.category) {
      const prefix = fold(word.slice(1));
      const hits = TODO_CATEGORIES.filter((c) => fold(TODO_CATEGORY_META[c].label).startsWith(prefix) || (prefix.startsWith("admin") && c === "ADMINISTRATIE"));
      if (hits.length === 1) {
        result.category = hits[0];
        chips.push({ kind: "category", label: TODO_CATEGORY_META[hits[0]].label });
        continue;
      }
    }

    // client: @jan → the one client whose name starts with it
    if (word.startsWith("@") && word.length > 1 && !result.clientId) {
      const prefix = fold(word.slice(1));
      const hits = clients.filter((c) => fold(c.name).split(/\s+/).some((part) => part.startsWith(prefix)));
      if (hits.length === 1) {
        result.clientId = hits[0].id;
        chips.push({ kind: "client", label: hits[0].name });
        continue;
      }
    }

    // date (only a clean word, so "morgen" inside a sentence about "morgenmedicatie" is untouched)
    if (!result.dueDate) {
      const date = resolveDateWord(word.replace(/[.,;]$/, ""), todayISO);
      if (date) {
        result.dueDate = date;
        chips.push({ kind: "date", label: relativeDayLabel(date, todayISO) });
        continue;
      }
    }

    kept.push(word);
  }

  result.title = kept.join(" ").trim().slice(0, TODO_TITLE_MAX);
  return result;
}

// --- Filtering -------------------------------------------------------------

export type TodoSearchable = {
  title: string;
  description: string | null;
  clientName: string | null;
  category: TodoCategoryKey | null;
  claimedByName: string | null;
  checklist: ChecklistItem[];
};

/** Case- and accent-insensitive "all words must match" search over what is visible on the card. */
export function matchesSearch(todo: TodoSearchable, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(
    [todo.title, todo.description ?? "", todo.clientName ?? "", todo.category ? TODO_CATEGORY_META[todo.category].label : "", todo.claimedByName ?? "", ...todo.checklist.map((c) => c.text)].join(" ")
  );
  return words.every((w) => haystack.includes(w));
}
