import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { amsterdamDate, fullName, getZonedParts, AMSTERDAM_TZ, startOfToday } from "@/lib/utils";
import { notifyUsers } from "@/lib/push";
import { logger } from "@/lib/log";
import { logAudit } from "@/lib/audit";
import {
  comparePresence,
  PRESENCE_HISTORY_DAYS,
  validateReturnAt,
  type PresenceDay,
  type PresenceEntry,
  type PresenceHistory,
  type PresenceStatusKey,
} from "@/lib/presence-shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PresenceViewer = { userId: string; role: Role };

type LatestRow = {
  clientId: string;
  status: PresenceStatusKey;
  expectedReturnAt: Date | null;
  comment: string | null;
  updatedAt: Date;
  user: { name: string };
};

function toEntry(client: { id: string; firstName: string; lastName: string; room: string | null }, row: LatestRow | undefined): PresenceEntry {
  return {
    clientId: client.id,
    name: fullName(client),
    room: client.room || null,
    status: row ? row.status : null,
    expectedReturnAt: row?.expectedReturnAt ? row.expectedReturnAt.toISOString() : null,
    comment: row?.comment ?? "",
    changedAt: row ? row.updatedAt.toISOString() : null,
    changedByName: row?.user.name ?? null,
    version: row ? row.updatedAt.toISOString() : null,
  };
}

const LATEST_SELECT = {
  clientId: true,
  status: true,
  expectedReturnAt: true,
  comment: true,
  updatedAt: true,
  user: { select: { name: true } },
} as const;

/**
 * Presence is deliberately not scoped to "today": a status persists across
 * shifts and days until someone changes it, so the board reads the most
 * recent row per client. Every change still writes a dated row plus an event.
 */
export async function loadPresenceBoard(): Promise<PresenceEntry[]> {
  const [clients, rows] = await Promise.all([
    db.client.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true, room: true }, orderBy: { firstName: "asc" } }),
    db.presence.findMany({ orderBy: { date: "desc" }, distinct: ["clientId"], select: LATEST_SELECT }),
  ]);
  const byClient = new Map(rows.map((r) => [r.clientId, r as LatestRow]));
  return clients.map((c) => toEntry(c, byClient.get(c.id))).sort((a, b) => comparePresence(a, b));
}

export type PresenceChange = {
  clientId: string;
  status: PresenceStatusKey;
  expectedReturnAt: Date | null;
  comment: string;
  /** The `version` the editor saw; undefined skips the conflict check (legacy callers). */
  since?: string | null;
  force?: boolean;
};

export class PresenceConflictError extends Error {
  constructor(public current: PresenceEntry) {
    super("conflict");
  }
}

export type PresenceChangeResult = { entry: PresenceEntry; previous: PresenceStatusKey | null };

/** Applies one change: daily snapshot (upsert) + append-only event. Throws PresenceConflictError on a stale edit. */
export async function applyPresenceChange(session: { sub: string; role: Role }, change: PresenceChange): Promise<PresenceChangeResult> {
  const client = await db.client.findUnique({
    where: { id: change.clientId },
    select: { id: true, firstName: true, lastName: true, room: true, active: true },
  });
  if (!client) throw new AuthError("Cliënt niet gevonden", 404);

  const latest = (await db.presence.findFirst({ where: { clientId: client.id }, orderBy: { date: "desc" }, select: LATEST_SELECT })) as LatestRow | null;

  if (!change.force && change.since !== undefined) {
    const seen = change.since;
    const now = latest ? latest.updatedAt.toISOString() : null;
    if (seen !== now && latest && latest.status !== change.status) {
      throw new PresenceConflictError(toEntry(client, latest));
    }
  }

  const date = startOfToday();
  const comment = change.comment.trim() || null;
  const data = {
    status: change.status,
    present: change.status === "AANWEZIG",
    expectedReturnAt: change.status === "AANWEZIG" || change.status === "VERMIST" ? null : change.expectedReturnAt,
    comment,
    userId: session.sub,
  };
  await db.presence.upsert({
    where: { clientId_date: { clientId: client.id, date } },
    update: data,
    create: { clientId: client.id, date, ...data },
  });
  await db.presenceEvent.create({
    data: {
      clientId: client.id,
      userId: session.sub,
      status: change.status,
      expectedReturnAt: data.expectedReturnAt,
      comment,
    },
  });

  const fresh = (await db.presence.findFirst({ where: { clientId: client.id }, orderBy: { date: "desc" }, select: LATEST_SELECT })) as LatestRow;
  return { entry: toEntry(client, fresh), previous: latest ? latest.status : null };
}

// --- History ---------------------------------------------------------------

function dayKey(date: Date): string {
  const p = getZonedParts(date, AMSTERDAM_TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export async function loadPresenceHistory(clientId: string, now: Date = new Date()): Promise<PresenceHistory | null> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return null;

  const parts = getZonedParts(now, AMSTERDAM_TZ);
  const today = amsterdamDate(parts.year, parts.month, parts.day);
  const windowStart = new Date(today.getTime() - (PRESENCE_HISTORY_DAYS - 1) * DAY_MS - 3 * 60 * 60 * 1000);

  const [events, rows, before] = await Promise.all([
    db.presenceEvent.findMany({
      where: { clientId, createdAt: { gte: new Date(now.getTime() - PRESENCE_HISTORY_DAYS * DAY_MS) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    db.presence.findMany({ where: { clientId, date: { gte: windowStart } }, orderBy: { date: "asc" }, select: { date: true, status: true } }),
    db.presence.findFirst({ where: { clientId, date: { lt: windowStart } }, orderBy: { date: "desc" }, select: { status: true } }),
  ]);

  const byDay = new Map(rows.map((r) => [dayKey(r.date), r.status as PresenceStatusKey]));
  const days: PresenceDay[] = [];
  let carried: PresenceStatusKey | null = before ? (before.status as PresenceStatusKey) : null;
  for (let i = PRESENCE_HISTORY_DAYS - 1; i >= 0; i--) {
    // Noon avoids DST edge cases when stepping back whole days.
    const key = dayKey(new Date(today.getTime() - i * DAY_MS + 12 * 60 * 60 * 1000));
    const own = byDay.get(key);
    if (own) {
      carried = own;
      days.push({ date: key, status: own, derived: false });
    } else {
      days.push({ date: key, status: carried, derived: true });
    }
  }

  return {
    events: events.map((e) => ({
      id: e.id,
      status: e.status as PresenceStatusKey,
      expectedReturnAt: e.expectedReturnAt ? e.expectedReturnAt.toISOString() : null,
      comment: e.comment ?? "",
      byName: e.user.name,
      at: e.createdAt.toISOString(),
    })),
    days,
  };
}

// --- Missing-person alert ---------------------------------------------------

/**
 * Tells every other active colleague that somebody is reported missing (or
 * found again), via web push. Privacy: a push shows on lock screens, so the
 * text never names the client — the colleague opens the app to see who.
 * Best effort and never throws: an alert failure must not fail the
 * registration.
 */
export async function notifyMissingStatus(actorId: string, kind: "missing" | "found"): Promise<void> {
  try {
    const staff = await db.user.findMany({ where: { active: true, NOT: { id: actorId } }, select: { id: true } });
    const payload =
      kind === "missing"
        ? { title: "Cliënt vermist gemeld", body: "Open Aanwezigheid om te zien wie het is en wat er nodig is.", url: "/aanwezigheid" }
        : { title: "Vermiste cliënt is terug", body: "De vermeldingen in Aanwezigheid zijn bijgewerkt.", url: "/aanwezigheid" };
    await notifyUsers(staff.map((s) => s.id), payload);
  } catch (error) {
    logger.error("presence.notify_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

// --- Validated entry point --------------------------------------------------

type Actor = { sub: string; role: Role };

/** Rules that don't depend on the database; the bulk route runs them once up front. */
export function assertPresenceInputValid(change: Pick<PresenceChange, "status" | "comment" | "expectedReturnAt">, now: Date = new Date()): void {
  const returnError = validateReturnAt(change.status, change.expectedReturnAt, now);
  if (returnError) throw new AuthError(returnError, 422);
}

/**
 * The one way a change enters the system (single route, bulk route): checks
 * the rules that don't depend on the database, applies it, writes the audit
 * line (ids and status only — never the comment) and raises the
 * missing-person alert when somebody newly becomes VERMIST (or is found
 * again).
 */
export async function submitPresenceChange(actor: Actor, change: PresenceChange, now: Date = new Date()): Promise<PresenceChangeResult> {
  assertPresenceInputValid(change, now);

  const result = await applyPresenceChange(actor, change);

  await logAudit({ userId: actor.sub, action: "presence.set", targetType: "Client", targetId: change.clientId });

  const wasMissing = result.previous === "VERMIST";
  const isMissing = change.status === "VERMIST";
  if (isMissing && !wasMissing) await notifyMissingStatus(actor.sub, "missing");
  else if (wasMissing && !isMissing) await notifyMissingStatus(actor.sub, "found");
  return result;
}
