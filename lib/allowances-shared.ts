// Client-safe half of Toegestane tijd (telefoon, bezoek, buiten, ...): types,
// labels and the pure state/formatting rules shared by the server query, the
// API routes and the client board. No "server-only", no node:crypto, no
// Prisma runtime import — sealing and database access live in
// lib/allowances-seal.ts and lib/allowances.ts.

export const ALLOWANCE_TYPES = ["PHONE", "SCREEN", "VISIT", "OUTSIDE", "WIFI", "KITCHEN", "ERRAND", "ROOM", "OTHER"] as const;
export type AllowanceTypeKey = (typeof ALLOWANCE_TYPES)[number];

export const ALLOWANCE_TYPE_META: Record<AllowanceTypeKey, { label: string }> = {
  PHONE: { label: "Telefoon" },
  SCREEN: { label: "Beeldscherm / gamen" },
  VISIT: { label: "Bezoek" },
  OUTSIDE: { label: "Buiten, onbegeleid" },
  WIFI: { label: "Internet / wifi" },
  KITCHEN: { label: "Keuken, zelfstandig" },
  ERRAND: { label: "Boodschappen alleen" },
  ROOM: { label: "Rust op kamer" },
  OTHER: { label: "Overig" },
};

export const ALLOWANCE_MODES = ["DURATION", "UNTIL"] as const;
export type AllowanceModeKey = (typeof ALLOWANCE_MODES)[number];

export const ALLOWANCE_STATUSES = ["SCHEDULED", "RUNNING", "PAUSED", "COMPLETED"] as const;
export type AllowanceStatusKey = (typeof ALLOWANCE_STATUSES)[number];

/**
 * Display-only derived state — distinct from AllowanceStatusKey, the stored
 * column. "expired" and "soon" are never written to the database: whether a
 * RUNNING allowance has run out (or is about to) is always computed from
 * allottedMs/endsAt against `now`, the same "derive, don't eagerly write"
 * approach as DemoAccess's effectiveBuildState (lib/demo-shared.ts) — no cron
 * flips a row the instant it expires, and a row that ran out an hour ago
 * still reads correctly on the next request.
 */
export type AllowanceEffectiveState = "scheduled" | "running" | "soon" | "paused" | "expired" | "completed";

export const ALLOWANCE_STATE_LABEL: Record<AllowanceEffectiveState, string> = {
  scheduled: "Gepland",
  running: "Loopt nu",
  soon: "Loopt bijna af",
  paused: "Gepauzeerd",
  expired: "Verlopen",
  completed: "Voltooid",
};

export const ALLOWANCE_DURATION_PRESETS_MIN = [15, 30, 60, 120] as const;
export const ALLOWANCE_EXTEND_MS = 15 * 60 * 1000;
/** A RUNNING duration-mode allowance with less than this left shows as "soon" (loopt bijna af), not plain "running". */
export const ALLOWANCE_SOON_THRESHOLD_MS = 5 * 60 * 1000;
export const ALLOWANCE_NOTE_MAX = 500;
export const ALLOWANCE_MIN_MINUTES = 5;
export const ALLOWANCE_MAX_MINUTES = 8 * 60;

/** Minimal shape effectiveAllowanceState/remainingMs need — matches both the Prisma row and the client-facing AllowanceData below. */
export type AllowanceTimingFields = {
  status: AllowanceStatusKey;
  mode: AllowanceModeKey;
  allottedMs: number | null;
  endsAt: string | null;
  startAt: string | null;
  usedMs: number;
  sessionStartedAt: string | null;
};

export type AllowanceData = AllowanceTimingFields & {
  id: string;
  clientId: string;
  clientName: string;
  clientRoom: string | null;
  type: AllowanceTypeKey;
  note: string | null;
  createdByName: string;
  createdAt: string;
  completedAt: string | null;
};

/** Time left: negative once a RUNNING/SCHEDULED allowance has run past its allotment or deadline. */
export function remainingMs(a: AllowanceTimingFields, now: number = Date.now()): number {
  if (a.mode === "DURATION") {
    const total = a.allottedMs ?? 0;
    const elapsedThisSession = a.status === "RUNNING" && a.sessionStartedAt ? now - new Date(a.sessionStartedAt).getTime() : 0;
    return total - (a.usedMs + elapsedThisSession);
  }
  const endsAt = a.endsAt ? new Date(a.endsAt).getTime() : now;
  return endsAt - now;
}

/** The full allotment: allottedMs for DURATION mode, or the original endsAt-minus-createdAt span for UNTIL mode (needed for a progress bar). */
export function totalAllowanceMs(a: AllowanceTimingFields, createdAt: string): number {
  if (a.mode === "DURATION") return a.allottedMs ?? 0;
  const ends = a.endsAt ? new Date(a.endsAt).getTime() : 0;
  const start = new Date(createdAt).getTime();
  return Math.max(ends - start, 1);
}

export function effectiveAllowanceState(a: AllowanceTimingFields, now: number = Date.now()): AllowanceEffectiveState {
  if (a.status === "COMPLETED") return "completed";
  if (a.status === "PAUSED") return "paused";
  if (a.status === "SCHEDULED") {
    // A SCHEDULED row becomes RUNNING on its own once startAt arrives — see
    // startOrAdvanceAllowance in lib/allowances.ts, called on every read.
    return "scheduled";
  }
  // RUNNING — "soon" applies to both modes: a visit five minutes from its
  // deadline is just as worth flagging as a phone timer with five minutes left.
  const left = remainingMs(a, now);
  if (left <= 0) return "expired";
  if (left <= ALLOWANCE_SOON_THRESHOLD_MS) return "soon";
  return "running";
}

/** mm:ss, or H:MM:SS once an hour or more — same breakpoint for "remaining" and "over time" (negative shows with a leading "-"). */
export function formatCountdown(ms: number): string {
  const negative = ms < 0;
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const out = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return negative ? `-${out}` : out;
}

/** Coarser "N min" / "H uur" form — used wherever seconds aren't meaningful (presets, weekly totals, the UNTIL-mode deadline countdown). */
export function formatDurationCoarse(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} uur`;
  return `${h}u ${m}m`;
}

export function formatClockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Sort key for grouped lists: most urgent first within a group (expired/running/soon by remaining time, scheduled by startAt, completed newest first). */
export function compareAllowanceUrgency(a: AllowanceData, b: AllowanceData, now: number = Date.now()): number {
  const stateA = effectiveAllowanceState(a, now);
  if (stateA === "completed") return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
  if (stateA === "scheduled") return (a.startAt ?? "").localeCompare(b.startAt ?? "");
  return remainingMs(a, now) - remainingMs(b, now);
}
