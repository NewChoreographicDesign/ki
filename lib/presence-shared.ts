// Client-safe half of the Aanwezigheid module: statuses, labels, types and the
// pure rules (what counts as overdue, how the board is ordered and summarised)
// that both the server routes and the browser use. Deliberately no
// "server-only" and no Prisma runtime import — database access lives in
// lib/presence.ts.

export const PRESENCE_STATUSES = ["AANWEZIG", "LOGEREN", "DAGBESTEDING", "ZIEKENHUIS", "VERLOF", "ANDERS", "VERMIST"] as const;
export type PresenceStatusKey = (typeof PRESENCE_STATUSES)[number];

/** Statuses a person can pick as a planned absence (VERMIST is a separate, deliberate action). */
export const ABSENT_REASONS = ["LOGEREN", "DAGBESTEDING", "ZIEKENHUIS", "VERLOF", "ANDERS"] as const;

export const PRESENCE_STATUS_META: Record<PresenceStatusKey, { label: string; short: string; hint: string }> = {
  AANWEZIG: { label: "Aanwezig", short: "In huis", hint: "De cliënt is in huis" },
  LOGEREN: { label: "Logeren / familie", short: "Logeren", hint: "Weekend of dagen bij familie of naasten" },
  DAGBESTEDING: { label: "Dagbesteding / school", short: "Dagbesteding", hint: "Dagbesteding, school of werk" },
  ZIEKENHUIS: { label: "Ziekenhuis / medisch", short: "Ziekenhuis", hint: "Opname of afspraak buiten de deur" },
  VERLOF: { label: "Verlof / vakantie", short: "Verlof", hint: "Vakantie of officieel verlof" },
  ANDERS: { label: "Anders afwezig", short: "Afwezig", hint: "Andere geplande afwezigheid" },
  VERMIST: { label: "Vermist", short: "Vermist", hint: "Onverwacht weg of niet teruggekeerd — iedereen krijgt een melding" },
};

export const PRESENCE_MAX_COMMENT = 500;
/** Bulk changes are limited so one slip can never flip the whole house. */
export const PRESENCE_BULK_MAX = 50;
/** How long after the expected return time we call a client "te laat". */
export const PRESENCE_GRACE_MS = 15 * 60 * 1000;
/** A return time further away than this is almost certainly a typo. */
export const PRESENCE_MAX_RETURN_DAYS = 365;
export const PRESENCE_HISTORY_DAYS = 30;

export function isPresentStatus(status: PresenceStatusKey | null): boolean {
  return status === "AANWEZIG";
}

/** A client as the browser sees it, already reduced to what the board shows. */
export type PresenceEntry = {
  clientId: string;
  name: string;
  room: string | null;
  /** null = never registered. */
  status: PresenceStatusKey | null;
  expectedReturnAt: string | null;
  comment: string;
  /** When the current status was set, and by whom. */
  changedAt: string | null;
  changedByName: string | null;
  /** Opaque token of the row the viewer saw; sent back for conflict detection. */
  version: string | null;
};

export type ReturnState = "overdue" | "soon" | "later" | "none";

/** Is an absent client expected back, and are they late? Only meaningful for planned absences. */
export function returnState(entry: Pick<PresenceEntry, "status" | "expectedReturnAt">, now: number = Date.now()): ReturnState {
  if (!entry.status || entry.status === "AANWEZIG" || entry.status === "VERMIST" || !entry.expectedReturnAt) return "none";
  const due = new Date(entry.expectedReturnAt).getTime();
  if (now > due + PRESENCE_GRACE_MS) return "overdue";
  if (due - now <= 2 * 60 * 60 * 1000) return "soon";
  return "later";
}

/** Whole minutes late, 0 when not overdue. */
export function minutesOverdue(entry: Pick<PresenceEntry, "status" | "expectedReturnAt">, now: number = Date.now()): number {
  if (returnState(entry, now) !== "overdue") return 0;
  return Math.floor((now - new Date(entry.expectedReturnAt as string).getTime()) / 60_000);
}

/** Triage order: missing first, then overdue returns, then unregistered, then absent, then present; name within a group. */
export function comparePresence(a: PresenceEntry, b: PresenceEntry, now: number = Date.now()): number {
  const rank = (e: PresenceEntry) => {
    if (e.status === "VERMIST") return 0;
    if (returnState(e, now) === "overdue") return 1;
    if (e.status === null) return 2;
    if (e.status !== "AANWEZIG") return 3;
    return 4;
  };
  return rank(a) - rank(b) || a.name.localeCompare(b.name, "nl");
}

export type PresenceSummary = {
  total: number;
  present: number;
  absent: number;
  missing: number;
  unregistered: number;
  overdue: number;
};

export function summarizePresence(entries: PresenceEntry[], now: number = Date.now()): PresenceSummary {
  const s: PresenceSummary = { total: entries.length, present: 0, absent: 0, missing: 0, unregistered: 0, overdue: 0 };
  for (const e of entries) {
    if (e.status === null) s.unregistered++;
    else if (e.status === "AANWEZIG") s.present++;
    else if (e.status === "VERMIST") s.missing++;
    else s.absent++;
    if (returnState(e, now) === "overdue") s.overdue++;
  }
  return s;
}

/** Everything the history sheet shows for one client. */
export type PresenceHistoryEvent = {
  id: string;
  status: PresenceStatusKey;
  expectedReturnAt: string | null;
  comment: string;
  byName: string;
  at: string;
};

/** One day in the 30-day strip; `derived` = carried forward from an earlier day, nobody registered that day. */
export type PresenceDay = { date: string; status: PresenceStatusKey | null; derived: boolean };

export type PresenceHistory = { events: PresenceHistoryEvent[]; days: PresenceDay[] };

/**
 * Validates a requested return time against "now". Returns an error message in
 * Dutch, or null when fine. A time slightly in the past is tolerated (the
 * clock on a tablet can drift a few minutes).
 */
export function validateReturnAt(status: PresenceStatusKey, returnAt: Date | null, now: Date = new Date()): string | null {
  if (!returnAt) return null;
  if (status === "AANWEZIG" || status === "VERMIST") return "Bij deze status past geen verwachte terugkomst";
  if (Number.isNaN(returnAt.getTime())) return "Ongeldige terugkomsttijd";
  if (returnAt.getTime() < now.getTime() - 10 * 60 * 1000) return "De verwachte terugkomst ligt in het verleden";
  if (returnAt.getTime() > now.getTime() + PRESENCE_MAX_RETURN_DAYS * 24 * 60 * 60 * 1000) return "De verwachte terugkomst ligt te ver in de toekomst";
  return null;
}
