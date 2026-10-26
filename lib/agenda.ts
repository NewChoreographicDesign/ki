import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formatDateTime, fullName, parseDatetimeLocalAsAmsterdam, toDatetimeLocalValue } from "@/lib/utils";
import { datePartOfLocal, expandOccurrenceDates, formatYmd, parseYmd, timePartOfLocal, type RepeatRule } from "@/lib/appointment-recurrence";
import { addDaysISO, diffDaysISO } from "@/lib/date-shared";
import {
  AGENDA_CATEGORIES,
  findConflicts,
  type AgendaCategoryKey,
  type AgendaConflict,
  type AgendaEventKey,
  type AgendaEventView,
  type AgendaItem,
  type AgendaClientOption,
  type AgendaStaffOption,
  type AgendaStatusKey,
} from "@/lib/agenda-shared";

// --- Include / mapping ---------------------------------------------------------------

export const AGENDA_INCLUDE = {
  createdBy: { select: { name: true } },
  assignee: { select: { name: true } },
  client: { select: { id: true, firstName: true, lastName: true, room: true } },
} satisfies Prisma.AppointmentInclude;

export type RawAppointment = Prisma.AppointmentGetPayload<{ include: typeof AGENDA_INCLUDE }>;

/**
 * Token of the content a person edits. Status, outcome and begeleider change
 * through their own actions and deliberately don't count, so a colleague
 * ticking "afgerond" doesn't reject a long edit.
 */
export function agendaVersion(a: RawAppointment): string {
  const payload = JSON.stringify([
    a.title,
    a.description,
    a.location,
    a.category,
    a.clientId,
    a.allDay,
    a.startAt.toISOString(),
    a.endAt?.toISOString() ?? null,
    a.remindMinutes,
  ]);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function toAgendaItem(a: RawAppointment): AgendaItem {
  return {
    id: a.id,
    title: a.title,
    description: a.description || null,
    location: a.location || null,
    category: (a.category as AgendaCategoryKey | null) ?? null,
    status: a.status as AgendaStatusKey,
    outcome: a.outcome || null,
    allDay: a.allDay,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt ? a.endAt.toISOString() : null,
    clientId: a.clientId,
    clientName: a.client ? fullName(a.client) : null,
    assigneeId: a.assigneeId,
    assigneeName: a.assignee?.name ?? null,
    createdById: a.createdById,
    createdByName: a.createdBy.name,
    seriesId: a.seriesId,
    remindMinutes: a.remindMinutes,
    version: agendaVersion(a),
  };
}

// --- Permissions -----------------------------------------------------------------------

export type AgendaActor = { sub: string; role: Role; name?: string };

function isSupervisor(role: Role): boolean {
  return role === Role.ADMIN || role === Role.COORDINATOR;
}

/**
 * Everyone can create, edit, move, finish and cancel an afspraak (a wrong
 * time must be fixable by whoever sees it; the event log keeps it
 * accountable). Removing it for good — which also erases its history — is
 * for the person who made it and for supervisors; everybody else cancels.
 */
export function canDeleteAppointment(actor: Pick<AgendaActor, "sub" | "role">, a: { createdById: string }): boolean {
  return isSupervisor(actor.role) || a.createdById === actor.sub;
}

export function canSupervise(role: Role): boolean {
  return isSupervisor(role);
}

// --- Loading -----------------------------------------------------------------------------

export async function loadAppointment(id: string): Promise<RawAppointment> {
  const row = await db.appointment.findUnique({ where: { id }, include: AGENDA_INCLUDE });
  if (!row) throw new AuthError("Afspraak niet gevonden", 404);
  return row;
}

export class AgendaConflictError extends Error {
  constructor(public current: AgendaItem) {
    super("Een collega heeft deze afspraak zojuist gewijzigd");
  }
}

const MAX_RANGE_DAYS = 400;
const MAX_ROWS = 1500;

/** Every afspraak overlapping [from, to) — one that started before `from` but runs into it still counts. */
export async function listAgenda(from: Date, to: Date): Promise<AgendaItem[]> {
  const end = Math.min(to.getTime(), from.getTime() + MAX_RANGE_DAYS * 86_400_000);
  const rows = await db.appointment.findMany({
    where: { startAt: { gte: new Date(from.getTime() - 14 * 86_400_000), lt: new Date(end) } },
    include: AGENDA_INCLUDE,
    orderBy: { startAt: "asc" },
    take: MAX_ROWS,
  });
  return rows
    .filter((a) => (a.endAt ?? new Date(a.startAt.getTime() + (a.allDay ? 86_400_000 : 3_600_000))) > from)
    .map(toAgendaItem);
}

export async function listConflicts(
  candidate: { id?: string; clientId: string | null; assigneeId: string | null; startAt: Date; endAt: Date | null; allDay: boolean }
): Promise<AgendaConflict[]> {
  if (!candidate.clientId && !candidate.assigneeId) return [];
  const end = candidate.endAt ?? new Date(candidate.startAt.getTime() + (candidate.allDay ? 86_400_000 : 3_600_000));
  const rows = await db.appointment.findMany({
    where: {
      status: { not: "CANCELLED" },
      startAt: { lt: end, gte: new Date(candidate.startAt.getTime() - 15 * 86_400_000) },
      OR: [...(candidate.clientId ? [{ clientId: candidate.clientId }] : []), ...(candidate.assigneeId ? [{ assigneeId: candidate.assigneeId }] : [])],
    },
    include: AGENDA_INCLUDE,
    take: 50,
  });
  return findConflicts(
    { ...candidate, startAt: candidate.startAt.toISOString(), endAt: candidate.endAt?.toISOString() ?? null },
    rows.map(toAgendaItem)
  );
}

// --- Time input ------------------------------------------------------------------------

const MAX_SPAN_DAYS = 14;

type TimeInput = { startAt: string; endAt?: string | null; allDay?: boolean };
/** What repeats: wall-clock time of day and length (timed) or number of days (whole-day). */
type Template = { allDay: boolean; time: string; durationMs: number | null; spanDays: number };

function at(ymd: string, hm: string): Date {
  return parseDatetimeLocalAsAmsterdam(`${ymd}T${hm}`)!;
}

/** Validates the form's times into the first occurrence plus the template later occurrences are cut from. */
export function resolveTimes(input: TimeInput): { start: Date; end: Date | null; template: Template } {
  const startYmd = datePartOfLocal(input.startAt);
  if (parseYmd(startYmd) === null || (!input.allDay && !parseDatetimeLocalAsAmsterdam(input.startAt))) throw new AuthError("Ongeldige datum/tijd", 400);

  if (input.allDay) {
    const lastYmd = input.endAt ? datePartOfLocal(input.endAt) : startYmd;
    if (parseYmd(lastYmd) === null) throw new AuthError("Ongeldige einddatum", 400);
    const spanDays = diffDaysISO(lastYmd, startYmd) + 1;
    if (spanDays < 1) throw new AuthError("De einddatum moet op of na de begindatum liggen", 400);
    if (spanDays > MAX_SPAN_DAYS) throw new AuthError(`Een afspraak duurt maximaal ${MAX_SPAN_DAYS} dagen`, 400);
    const template: Template = { allDay: true, time: "00:00", durationMs: null, spanDays };
    return { start: at(startYmd, "00:00"), end: at(addDaysISO(startYmd, spanDays), "00:00"), template };
  }

  const start = parseDatetimeLocalAsAmsterdam(input.startAt)!;
  let durationMs: number | null = null;
  if (input.endAt) {
    const end = parseDatetimeLocalAsAmsterdam(input.endAt);
    if (!end) throw new AuthError("Ongeldige eindtijd", 400);
    if (end <= start) throw new AuthError("De eindtijd moet na de begintijd liggen", 400);
    if (end.getTime() - start.getTime() > MAX_SPAN_DAYS * 86_400_000) throw new AuthError(`Een afspraak duurt maximaal ${MAX_SPAN_DAYS} dagen`, 400);
    durationMs = end.getTime() - start.getTime();
  }
  const template: Template = { allDay: false, time: timePartOfLocal(input.startAt), durationMs, spanDays: 1 };
  return { start, end: durationMs ? new Date(start.getTime() + durationMs) : null, template };
}

function occurrence(ymd: string, t: Template): { start: Date; end: Date | null } {
  if (t.allDay) return { start: at(ymd, "00:00"), end: at(addDaysISO(ymd, t.spanDays), "00:00") };
  const start = at(ymd, t.time);
  return { start, end: t.durationMs ? new Date(start.getTime() + t.durationMs) : null };
}

// --- Validation of references ------------------------------------------------------------

const ASSIGNABLE: Role[] = [Role.EMPLOYEE, Role.COORDINATOR, Role.ADMIN, Role.INVALLER];

async function assertClient(clientId: string | null): Promise<{ firstName: string; lastName: string } | null> {
  if (!clientId) return null;
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AuthError("Cliënt niet gevonden", 404);
  return client;
}

async function assertAssignee(userId: string | null): Promise<void> {
  if (!userId) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { active: true, role: true } });
  if (!user || !user.active || !ASSIGNABLE.includes(user.role)) throw new AuthError("Begeleider niet gevonden", 404);
}

// --- Event log ---------------------------------------------------------------------------

export async function logAppointmentEvents(
  actor: AgendaActor,
  events: { appointmentId: string; type: AgendaEventKey; comment?: string | null }[]
): Promise<void> {
  if (events.length === 0) return;
  await db.appointmentEvent.createMany({
    data: events.map((e) => ({
      appointmentId: e.appointmentId,
      userId: actor.sub,
      type: e.type,
      comment: e.comment ?? null,
    })),
  });
}

export async function listEvents(appointmentId: string): Promise<AgendaEventView[]> {
  await loadAppointment(appointmentId);
  const rows = await db.appointmentEvent.findMany({
    where: { appointmentId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((e) => ({
    id: e.id,
    type: e.type as AgendaEventKey,
    comment: e.comment || null,
    userName: e.user.name,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function addComment(actor: AgendaActor, appointmentId: string, text: string): Promise<void> {
  await loadAppointment(appointmentId);
  await logAppointmentEvents(actor, [{ appointmentId, type: "COMMENT", comment: text }]);
  await logAudit({ userId: actor.sub, action: "appointment.comment", targetType: "Appointment", targetId: appointmentId });
}

// --- Create -------------------------------------------------------------------------------

export type AppointmentInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  category?: AgendaCategoryKey | "" | null;
  clientId?: string | null;
  assigneeId?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  remindMinutes?: number | null;
};

const normCategory = (c: AppointmentInput["category"]): AgendaCategoryKey | null => (c && (AGENDA_CATEGORIES as readonly string[]).includes(c) ? c : null);

export async function createAppointments(
  actor: AgendaActor,
  input: AppointmentInput,
  repeat: RepeatRule = { mode: "none" }
): Promise<{ ids: string[]; seriesId: string | null }> {
  const { template } = resolveTimes(input);
  const clientId = input.clientId || null;
  const assigneeId = input.assigneeId || null;
  await assertClient(clientId);
  await assertAssignee(assigneeId);

  let dates: string[];
  try {
    dates = expandOccurrenceDates(datePartOfLocal(input.startAt), repeat);
  } catch (error) {
    throw new AuthError(error instanceof RangeError ? error.message : "Ongeldige herhaling", 400);
  }

  const seriesId = dates.length > 1 ? randomUUID() : null;
  const rows = dates.map((date) => {
    const { start, end } = occurrence(date, template);
    return {
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      category: normCategory(input.category),
      clientId,
      assigneeId,
      startAt: start,
      endAt: end,
      allDay: template.allDay,
      remindMinutes: input.remindMinutes ?? null,
      seriesId,
      createdById: actor.sub,
    };
  });
  await db.appointment.createMany({ data: rows });
  await logAppointmentEvents(actor, rows.map((r) => ({ appointmentId: r.id, type: "CREATED" as const })));

  await logAudit({
    userId: actor.sub,
    action: seriesId ? `appointment.create_series:${rows.length}` : "appointment.create",
    targetType: "Appointment",
    targetId: seriesId ?? rows[0].id,
  });
  return { ids: rows.map((r) => r.id), seriesId };
}

// --- Edit -----------------------------------------------------------------------------------

export type Scope = "this" | "following" | "all";
export const parseScope = (value: string | null | undefined): Scope => (value === "following" || value === "all" ? value : "this");

/** The rows a series-wide action applies to. A standalone afspraak is always just itself. */
async function targetRows(existing: { id: string; seriesId: string | null; startAt: Date }, scope: Scope): Promise<RawAppointment[]> {
  if (scope === "this" || !existing.seriesId) return [await db.appointment.findUniqueOrThrow({ where: { id: existing.id }, include: AGENDA_INCLUDE })];
  return db.appointment.findMany({
    where: { seriesId: existing.seriesId, ...(scope === "following" ? { startAt: { gte: existing.startAt } } : {}) },
    include: AGENDA_INCLUDE,
    orderBy: { startAt: "asc" },
  });
}

/** Readable summary for the event log. */
function describeChanges(before: RawAppointment, after: AppointmentInput & { start: Date }, names: { before: string | null; after: string | null }): { summary: string | null; fields: string[]; timeOnly: boolean } {
  const parts: string[] = [];
  const fields: string[] = [];
  if (before.title !== after.title.trim()) {
    parts.push(`titel "${before.title}" -> "${after.title.trim()}"`);
    fields.push("titel");
  }
  if (before.startAt.getTime() !== after.start.getTime()) {
    parts.push(`tijd ${formatDateTime(before.startAt)} -> ${formatDateTime(after.start)}`);
    fields.push("tijd");
  }
  if (before.allDay !== Boolean(after.allDay)) fields.push("hele dag");
  if (before.clientId !== (after.clientId || null)) {
    parts.push(`cliënt ${names.before ?? "geen"} -> ${names.after ?? "geen"}`);
    fields.push("cliënt");
  }
  if (before.category !== normCategory(after.category)) fields.push("categorie");
  if ((before.description || "") !== (after.description ?? "").trim()) fields.push("omschrijving");
  if ((before.location || "") !== (after.location ?? "").trim()) fields.push("locatie");
  if ((before.remindMinutes ?? null) !== (after.remindMinutes ?? null)) fields.push("herinnering");
  const timeOnly = fields.length === 1 && fields[0] === "tijd";
  const extra = fields.filter((f) => !["titel", "tijd", "cliënt"].includes(f));
  if (extra.length) parts.push(`aangepast: ${extra.join(", ")}`);
  return { summary: parts.length ? parts.join("; ") : null, fields, timeOnly };
}

export async function updateAppointments(
  actor: AgendaActor,
  id: string,
  input: AppointmentInput,
  opts: { scope?: Scope; version?: string; force?: boolean } = {}
): Promise<{ updated: AgendaItem[] }> {
  const existing = await loadAppointment(id);
  if (opts.version && !opts.force && opts.version !== agendaVersion(existing)) throw new AgendaConflictError(toAgendaItem(existing));

  const { start, template } = resolveTimes(input);
  const newClientId = input.clientId || null;
  const clientChanged = newClientId !== existing.clientId;
  const afterClient = clientChanged ? await assertClient(newClientId) : null;
  const beforeClient = clientChanged && existing.clientId ? await db.client.findUnique({ where: { id: existing.clientId } }) : null;

  const change = describeChanges(existing, { ...input, start }, { before: beforeClient ? fullName(beforeClient) : null, after: afterClient ? fullName(afterClient) : null });
  const scope = opts.scope ?? "this";
  const rows = await targetRows(existing, scope);
  const dayDelta = Math.round((parseYmd(datePartOfLocal(input.startAt))! - parseYmd(datePartOfLocal(toDatetimeLocalValue(existing.startAt)))!) / 86_400_000);

  for (const row of rows) {
    let occ = { start, end: template.allDay ? occurrence(datePartOfLocal(input.startAt), template).end : template.durationMs ? new Date(start.getTime() + template.durationMs) : null };
    if (row.id !== existing.id) {
      // Series-wide edit: every other occurrence keeps its own date (moved by
      // the same number of days) and takes the new time of day.
      const rowDay = formatYmd(parseYmd(datePartOfLocal(toDatetimeLocalValue(row.startAt)))! + dayDelta * 86_400_000);
      occ = occurrence(rowDay, template);
    }
    await db.appointment.update({
      where: { id: row.id },
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        category: normCategory(input.category),
        clientId: newClientId,
        // The begeleider is changed through its own action (assignAppointment), never by an edit.
        startAt: occ.start,
        endAt: occ.end,
        allDay: template.allDay,
        remindMinutes: input.remindMinutes ?? null,
        // Moving an already-reminded afspraak must re-arm its reminder.
        ...(occ.start.getTime() !== row.startAt.getTime() ? { reminderSent: false } : {}),
      },
    });
  }

  if (change.summary || change.fields.length || rows.length > 1) {
    await logAppointmentEvents(
      actor,
      rows.map((r) => ({ appointmentId: r.id, type: change.timeOnly ? ("MOVED" as const) : ("EDITED" as const), comment: change.summary }))
    );
    await logAudit({
      userId: actor.sub,
      action: `appointment.edited:${change.fields.join(",") || "series"}${rows.length > 1 ? ` (${scope}, ${rows.length}x)` : ""}`,
      targetType: "Appointment",
      targetId: id,
    });
  }
  const fresh = await db.appointment.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: AGENDA_INCLUDE, orderBy: { startAt: "asc" } });
  return { updated: fresh.map(toAgendaItem) };
}

/** Drag-and-drop / quick reschedule of one afspraak; keeps its length unless a new end is given. */
export async function moveAppointment(actor: AgendaActor, id: string, input: { startAt: string; endAt?: string | null; allDay?: boolean }): Promise<AgendaItem> {
  const existing = await loadAppointment(id);
  if (existing.status !== "PLANNED") throw new AuthError("Een afgeronde of geannuleerde afspraak kan niet worden verplaatst. Open hem eerst opnieuw.", 409);
  const { start, end } = resolveTimes(input);
  if (existing.startAt.getTime() === start.getTime() && existing.endAt?.getTime() === end?.getTime() && existing.allDay === Boolean(input.allDay)) return toAgendaItem(existing);
  await db.appointment.update({ where: { id }, data: { startAt: start, endAt: end, allDay: Boolean(input.allDay), reminderSent: false } });
  await logAppointmentEvents(actor, [{ appointmentId: id, type: "MOVED", comment: `tijd ${formatDateTime(existing.startAt)} -> ${formatDateTime(start)}` }]);
  await logAudit({ userId: actor.sub, action: "appointment.moved", targetType: "Appointment", targetId: id });
  return toAgendaItem(await loadAppointment(id));
}

// --- Status ---------------------------------------------------------------------------------------

export async function setStatus(actor: AgendaActor, id: string, status: AgendaStatusKey, note: string | null, scope: Scope = "this"): Promise<AgendaItem[]> {
  const existing = await loadAppointment(id);
  // Finishing and reopening are about one concrete afspraak; only cancelling a repeated one makes sense in bulk.
  const rows = status === "CANCELLED" ? await targetRows(existing, scope) : [existing];
  const eligible = rows.filter((r) => r.status !== status);
  const cleanNote = note?.trim() || null;
  await db.appointment.updateMany({
    where: { id: { in: eligible.map((r) => r.id) } },
    data: { status, outcome: status === "PLANNED" ? null : cleanNote },
  });
  const type = status === "DONE" ? "COMPLETED" : status === "CANCELLED" ? "CANCELLED" : "REOPENED";
  await logAppointmentEvents(actor, eligible.map((r) => ({ appointmentId: r.id, type, comment: cleanNote })));
  await logAudit({
    userId: actor.sub,
    action: `appointment.${type.toLowerCase()}${eligible.length > 1 ? ` (${scope}, ${eligible.length}x)` : ""}`,
    targetType: "Appointment",
    targetId: id,
  });
  const fresh = await db.appointment.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: AGENDA_INCLUDE, orderBy: { startAt: "asc" } });
  return fresh.map(toAgendaItem);
}

// --- Begeleider ---------------------------------------------------------------------------------------

export class AgendaTakeoverError extends Error {
  constructor(public assigneeName: string) {
    super(`${assigneeName} gaat al mee. Wil je het overnemen?`);
  }
}

/**
 * "Ik ga mee" / vrijgeven / iemand anders kiezen. Taking over a colleague's
 * afspraak must be a deliberate choice (`takeover`); only the begeleider or
 * a supervisor can release it; choosing someone else is for supervisors and
 * the person who made the afspraak.
 */
export async function assignAppointment(actor: AgendaActor, id: string, target: { userId: string | null; takeover?: boolean }): Promise<AgendaItem> {
  const existing = await loadAppointment(id);
  if (existing.assigneeId === target.userId) return toAgendaItem(existing);

  if (target.userId === null) {
    if (existing.assigneeId !== actor.sub && !isSupervisor(actor.role)) throw new AuthError("Alleen de begeleider of een leidinggevende kan dit vrijgeven", 403);
  } else {
    if (target.userId !== actor.sub && !isSupervisor(actor.role) && existing.createdById !== actor.sub) throw new AuthError("Je kunt jezelf als begeleider kiezen", 403);
    await assertAssignee(target.userId);
    if (existing.assigneeId && existing.assigneeId !== actor.sub && target.userId === actor.sub && !target.takeover && !isSupervisor(actor.role)) {
      throw new AgendaTakeoverError(existing.assignee?.name ?? "Een collega");
    }
  }
  await db.appointment.update({ where: { id }, data: { assigneeId: target.userId } });
  const assigneeName = target.userId ? (await db.user.findUnique({ where: { id: target.userId }, select: { name: true } }))?.name ?? null : null;
  await logAppointmentEvents(actor, [{ appointmentId: id, type: target.userId ? "ASSIGNED" : "UNASSIGNED", comment: target.userId ? assigneeName : existing.assignee?.name ?? null }]);
  await logAudit({ userId: actor.sub, action: target.userId ? "appointment.assigned" : "appointment.unassigned", targetType: "Appointment", targetId: id });
  return toAgendaItem(await loadAppointment(id));
}

// --- Delete ---------------------------------------------------------------------------------------------

export async function deleteAppointments(actor: AgendaActor, id: string, scope: Scope): Promise<number> {
  const existing = await loadAppointment(id);
  if (!canDeleteAppointment(actor, existing)) throw new AuthError("Alleen de maker of een leidinggevende kan een afspraak verwijderen. Annuleer hem in plaats daarvan.", 403);
  const rows = await targetRows(existing, scope);
  await db.appointment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  await logAudit({
    userId: actor.sub,
    action: `appointment.deleted${rows.length > 1 ? ` (${scope}, ${rows.length}x)` : ""}`,
    targetType: "Appointment",
    targetId: id,
  });
  return rows.length;
}

// --- Page data ------------------------------------------------------------------------------

/** What the Agenda screen needs besides the afspraken: client and staff pickers. */
export async function loadAgendaEnv(): Promise<{ clients: AgendaClientOption[]; staff: AgendaStaffOption[] }> {
  const [clients, staff] = await Promise.all([
    db.client.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    db.user.findMany({ where: { active: true, role: { in: ASSIGNABLE } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, name: fullName(c) })),
    staff,
  };
}
