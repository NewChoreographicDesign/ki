import "server-only";
import { db } from "@/lib/db";
import { AuthError, type SessionPayload } from "@/lib/auth";
import { fullName } from "@/lib/utils";
import {
  ALLOWANCE_EXTEND_MS,
  type AllowanceData,
  type AllowanceModeKey,
  type AllowanceTypeKey,
} from "@/lib/allowances-shared";

const ALLOWANCE_INCLUDE = {
  client: { select: { firstName: true, lastName: true, room: true } },
  createdBy: { select: { name: true } },
} as const;

type RawAllowance = NonNullable<Awaited<ReturnType<typeof fetchOne>>>;
async function fetchOne(id: string) {
  return db.allowance.findUnique({ where: { id }, include: ALLOWANCE_INCLUDE });
}

function toAllowanceData(row: RawAllowance): AllowanceData {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: fullName(row.client),
    clientRoom: row.client.room,
    type: row.type,
    mode: row.mode,
    status: row.status,
    allottedMs: row.allottedMs,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    usedMs: row.usedMs,
    sessionStartedAt: row.sessionStartedAt ? row.sessionStartedAt.toISOString() : null,
    note: row.note,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

async function requireClient(clientId: string): Promise<void> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new AuthError("Cliënt niet gevonden", 400);
}

// A SCHEDULED allowance becomes RUNNING entirely on read — there is no cron
// for this, same reasoning as effectiveAllowanceState not writing EXPIRED.
// sessionStartedAt is backdated to the original startAt (not "now") so a
// DURATION allowance nobody opened the page for the instant it was due still
// counts its elapsed time correctly.
async function advanceScheduledAllowances(now: Date = new Date()): Promise<void> {
  const due = await db.allowance.findMany({ where: { status: "SCHEDULED", startAt: { lte: now } }, select: { id: true, mode: true, startAt: true } });
  if (due.length === 0) return;
  await Promise.all(
    due.map((a) => db.allowance.update({ where: { id: a.id }, data: { status: "RUNNING", sessionStartedAt: a.mode === "DURATION" ? a.startAt : null } }))
  );
}

export async function loadAllowanceBoard(now: Date = new Date()): Promise<{ active: AllowanceData[]; completedToday: AllowanceData[] }> {
  await advanceScheduledAllowances(now);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const [active, completedToday] = await Promise.all([
    db.allowance.findMany({ where: { status: { in: ["SCHEDULED", "RUNNING", "PAUSED"] } }, include: ALLOWANCE_INCLUDE, orderBy: { createdAt: "asc" }, take: 200 }),
    db.allowance.findMany({ where: { status: "COMPLETED", completedAt: { gte: todayStart } }, include: ALLOWANCE_INCLUDE, orderBy: { completedAt: "desc" }, take: 50 }),
  ]);
  return { active: active.map(toAllowanceData), completedToday: completedToday.map(toAllowanceData) };
}

export type AllowanceCreateInput = {
  clientId: string;
  type: AllowanceTypeKey;
  mode: AllowanceModeKey;
  /** DURATION mode only. */
  allottedMinutes?: number;
  /** UNTIL mode only — full ISO moment, computed client-side from the chosen clock time. */
  endsAt?: string;
  /** Either mode, optional — stage it for later today instead of starting immediately. */
  startAt?: string;
  note?: string;
};

export async function createAllowance(actor: SessionPayload, input: AllowanceCreateInput, now: Date = new Date()): Promise<AllowanceData> {
  await requireClient(input.clientId);
  const startsLater = Boolean(input.startAt) && new Date(input.startAt!) > now;
  const row = await db.allowance.create({
    data: {
      clientId: input.clientId,
      type: input.type,
      mode: input.mode,
      status: startsLater ? "SCHEDULED" : "RUNNING",
      allottedMs: input.mode === "DURATION" ? Math.round((input.allottedMinutes ?? 0) * 60_000) : null,
      endsAt: input.mode === "UNTIL" ? new Date(input.endsAt!) : null,
      startAt: startsLater ? new Date(input.startAt!) : null,
      sessionStartedAt: !startsLater && input.mode === "DURATION" ? now : null,
      note: input.note || null,
      createdById: actor.sub,
    },
    include: ALLOWANCE_INCLUDE,
  });
  return toAllowanceData(row);
}

export type AllowanceAction = "start" | "pause" | "resume" | "complete" | "extend";

export async function applyAllowanceAction(id: string, action: AllowanceAction, now: Date = new Date()): Promise<AllowanceData> {
  const a = await fetchOne(id);
  if (!a) throw new AuthError("Niet gevonden", 404);

  if (action === "start") {
    if (a.status !== "SCHEDULED") throw new AuthError("Deze toestemming is al gestart", 409);
    const row = await db.allowance.update({
      where: { id },
      data: { status: "RUNNING", startAt: null, sessionStartedAt: a.mode === "DURATION" ? now : null },
      include: ALLOWANCE_INCLUDE,
    });
    return toAllowanceData(row);
  }
  if (action === "pause") {
    if (a.status !== "RUNNING" || a.mode !== "DURATION") throw new AuthError("Kan nu niet gepauzeerd worden", 409);
    const elapsed = a.sessionStartedAt ? now.getTime() - a.sessionStartedAt.getTime() : 0;
    const row = await db.allowance.update({
      where: { id },
      data: { status: "PAUSED", usedMs: a.usedMs + Math.max(elapsed, 0), sessionStartedAt: null },
      include: ALLOWANCE_INCLUDE,
    });
    return toAllowanceData(row);
  }
  if (action === "resume") {
    if (a.status !== "PAUSED") throw new AuthError("Kan nu niet hervat worden", 409);
    const row = await db.allowance.update({ where: { id }, data: { status: "RUNNING", sessionStartedAt: now }, include: ALLOWANCE_INCLUDE });
    return toAllowanceData(row);
  }
  if (action === "complete") {
    if (a.status !== "RUNNING" && a.status !== "PAUSED") throw new AuthError("Kan nu niet afgerond worden", 409);
    const elapsed = a.status === "RUNNING" && a.sessionStartedAt ? now.getTime() - a.sessionStartedAt.getTime() : 0;
    const row = await db.allowance.update({
      where: { id },
      data: { status: "COMPLETED", usedMs: a.usedMs + Math.max(elapsed, 0), sessionStartedAt: null, completedAt: now },
      include: ALLOWANCE_INCLUDE,
    });
    return toAllowanceData(row);
  }
  // extend
  if (a.status !== "RUNNING" && a.status !== "PAUSED") throw new AuthError("Kan nu niet verlengd worden", 409);
  const row = await db.allowance.update({
    where: { id },
    data:
      a.mode === "DURATION"
        ? { allottedMs: (a.allottedMs ?? 0) + ALLOWANCE_EXTEND_MS }
        : { endsAt: new Date((a.endsAt ?? now).getTime() + ALLOWANCE_EXTEND_MS) },
    include: ALLOWANCE_INCLUDE,
  });
  return toAllowanceData(row);
}
