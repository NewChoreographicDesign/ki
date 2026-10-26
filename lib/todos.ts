import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { fullName, formatDaysOfWeek, parseDaysOfWeek } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import {
  TODO_CHECKLIST_MAX,
  TODO_RECENT_DONE_DAYS,
  validateSnooze,
  type ChecklistItem,
  type TodoCategoryKey,
  type TodoClientOption,
  type TodoData,
  type TodoEventKey,
  type TodoEventView,
  type TodoPriorityKey,
} from "@/lib/todos-shared";

// --- Checklist ---------------------------------------------------------------
// ki doesn't seal any other Todo field (description, completionNote are
// plain text), so the checklist stays plain JSON too rather than
// introducing a half-applied encryption pattern for one field only.

export function openChecklist(stored: string | null | undefined): ChecklistItem[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is { id: unknown; text: unknown; done?: unknown } => typeof i === "object" && i !== null)
      .map((i) => ({ id: String(i.id ?? ""), text: String(i.text ?? ""), done: Boolean(i.done) }))
      .filter((i) => i.id && i.text)
      .slice(0, TODO_CHECKLIST_MAX);
  } catch {
    return [];
  }
}

export function sealChecklist(items: ChecklistItem[]): string | null {
  return items.length ? JSON.stringify(items) : null;
}

/**
 * Turns what the form sent into the stored list. Ids the task already has are
 * kept (so ticks and ordering survive an edit); new rows get a fresh id. The
 * `done` flag always comes from the stored task, never from the form: ticking
 * goes through the checklist endpoint, so an edit can't undo a colleague's tick.
 */
export function mergeChecklist(input: { id?: string; text: string; done?: boolean }[] | undefined, existing: ChecklistItem[]): ChecklistItem[] {
  if (!input) return existing;
  const byId = new Map(existing.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const out: ChecklistItem[] = [];
  for (const row of input.slice(0, TODO_CHECKLIST_MAX)) {
    const prior = row.id ? byId.get(row.id) : undefined;
    const id = prior && !seen.has(prior.id) ? prior.id : randomUUID().slice(0, 8);
    seen.add(id);
    out.push({ id, text: row.text.trim(), done: prior ? prior.done : false });
  }
  return out;
}

// --- Include / mapping -------------------------------------------------------

export const TODO_INCLUDE = {
  createdBy: { select: { name: true } },
  completedBy: { select: { name: true } },
  assignedTo: { select: { name: true } },
  claimedBy: { select: { name: true } },
  client: { select: { id: true, firstName: true, lastName: true, room: true } },
} satisfies Prisma.TodoInclude;

export type RawTodo = Prisma.TodoGetPayload<{ include: typeof TODO_INCLUDE }>;

/**
 * Token of the content a person edits. Changes when the title, text,
 * schedule, category, client or the checklist's wording change — NOT when a
 * colleague only ticks a step, claims the task or snoozes it, so a long edit
 * is not rejected for harmless activity.
 */
export function todoContentVersion(todo: RawTodo): string {
  const items = openChecklist(todo.checklist).map((i) => [i.id, i.text]);
  const payload = JSON.stringify([
    todo.title,
    todo.description ?? "",
    todo.priority,
    todo.daysOfWeek,
    todo.intervalDays,
    todo.intervalAnchorDate?.toISOString() ?? null,
    todo.showUntil?.toISOString() ?? null,
    todo.dueDate?.toISOString() ?? null,
    todo.time,
    todo.recurring,
    todo.category,
    todo.clientId,
    todo.room,
    items,
  ]);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toTodoData(raw: RawTodo): TodoData {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    priority: raw.priority as TodoPriorityKey,
    daysOfWeek: parseDaysOfWeek(raw.daysOfWeek),
    intervalDays: raw.intervalDays,
    intervalAnchorDate: iso(raw.intervalAnchorDate),
    showUntil: iso(raw.showUntil),
    dueDate: iso(raw.dueDate),
    interventionPlanId: raw.interventionPlanId,
    time: raw.time,
    recurring: raw.recurring,
    completed: raw.completed,
    completedByName: raw.completedBy?.name ?? null,
    completedAt: iso(raw.completedAt),
    completionNote: raw.completionNote,
    createdByName: raw.createdBy.name,
    createdById: raw.createdById,
    createdAt: raw.createdAt.toISOString(),
    assignedToId: raw.assignedToId,
    assignedToName: raw.assignedTo?.name ?? null,
    room: raw.room,
    category: (raw.category as TodoCategoryKey | null) ?? null,
    clientId: raw.clientId,
    clientName: raw.client ? fullName(raw.client) : null,
    claimedById: raw.claimedById,
    claimedByName: raw.claimedBy?.name ?? null,
    claimedAt: iso(raw.claimedAt),
    snoozedUntil: iso(raw.snoozedUntil),
    checklist: openChecklist(raw.checklist),
    version: todoContentVersion(raw),
  };
}

// --- Permissions ---------------------------------------------------------------

type Actor = { sub: string; role: Role; name?: string };
type TodoOwnership = { assignedToId: string | null; createdById: string };

const SUPERVISORS: Role[] = [Role.ADMIN, Role.COORDINATOR];
export const isSupervisor = (role: Role) => SUPERVISORS.includes(role);

/**
 * Edit / delete. A PERSONAL task (assignedToId set) belongs to that
 * medewerker, and to admin/coordinator (who can assign one). A SHARED task
 * can be changed by whoever made it and by supervisors — before this, only
 * an admin could, which left a typo in a colleague's task unfixable for
 * anyone else on shift.
 */
export function canManageTodo(actor: Pick<Actor, "sub" | "role">, todo: TodoOwnership): boolean {
  if (todo.assignedToId) return todo.assignedToId === actor.sub || actor.role === Role.ADMIN || actor.role === Role.COORDINATOR;
  return isSupervisor(actor.role) || todo.createdById === actor.sub;
}

/** Complete, comment, tick, snooze: anyone for a shared task; for a personal task only its owner and supervisors. */
export function canWorkOnTodo(actor: Pick<Actor, "sub" | "role">, todo: TodoOwnership): boolean {
  if (todo.assignedToId) return todo.assignedToId === actor.sub || isSupervisor(actor.role);
  return true;
}

// --- Loading -------------------------------------------------------------------

export async function loadTodoRow(id: string): Promise<RawTodo> {
  const row = await db.todo.findUnique({ where: { id }, include: TODO_INCLUDE });
  if (!row) throw new AuthError("Taak niet gevonden", 404);
  return row;
}

/** A task the actor may act on, or a 404 (never reveals that somebody else's personal task exists). */
export async function loadWorkableTodo(actor: Actor, id: string): Promise<RawTodo> {
  const row = await loadTodoRow(id);
  if (!canWorkOnTodo(actor, row)) throw new AuthError("Taak niet gevonden", 404);
  return row;
}

export type TodoBoardData = { open: TodoData[]; completed: TodoData[]; serverTime: string };

/** The shared Werklijst: every open shared task plus what was finished this past week. */
export async function loadTodoBoard(now: Date = new Date()): Promise<TodoBoardData> {
  const since = new Date(now.getTime() - TODO_RECENT_DONE_DAYS * 86_400_000);
  const [open, completed] = await Promise.all([
    db.todo.findMany({ where: { completed: false, assignedToId: null }, include: TODO_INCLUDE, orderBy: { createdAt: "asc" }, take: 500 }),
    db.todo.findMany({ where: { completed: true, assignedToId: null, completedAt: { gte: since } }, include: TODO_INCLUDE, orderBy: { completedAt: "desc" }, take: 60 }),
  ]);
  return { open: open.map(toTodoData), completed: completed.map(toTodoData), serverTime: now.toISOString() };
}

export async function loadTodoClients(): Promise<TodoClientOption[]> {
  const rows = await db.client.findMany({
    where: { active: true },
    select: { id: true, firstName: true, lastName: true, room: true },
    orderBy: { firstName: "asc" },
  });
  return rows.map((c) => ({ id: c.id, name: fullName(c), room: c.room || null }));
}

// --- Events --------------------------------------------------------------------

export async function recordTodoEvent(actor: Actor, todoId: string, type: TodoEventKey, comment?: string | null): Promise<void> {
  await db.todoEvent.create({ data: { todoId, userId: actor.sub, type, comment: comment?.trim() || null } });
}

export async function loadTodoEvents(actor: Actor, todoId: string): Promise<TodoEventView[]> {
  await loadWorkableTodo(actor, todoId);
  const rows = await db.todoEvent.findMany({
    where: { todoId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    type: e.type as TodoEventKey,
    comment: e.comment ?? "",
    byName: e.user.name,
    at: e.createdAt.toISOString(),
  }));
}

// --- Writes --------------------------------------------------------------------

export class TodoConflictError extends Error {
  constructor(public current: TodoData) {
    super("conflict");
  }
}

export type TodoInput = {
  title: string;
  description?: string;
  priority: TodoPriorityKey;
  daysOfWeek?: number[];
  intervalDays?: number;
  intervalAnchorDate?: string;
  showUntil?: string;
  time?: string;
  recurring?: boolean;
  assignedToId?: string;
  room?: string;
  dueDate?: string;
  category?: TodoCategoryKey | null;
  clientId?: string | null;
  checklist?: { id?: string; text: string; done?: boolean }[];
  since?: string | null;
  force?: boolean;
};

const startOfDayUtc = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

async function assertClientExists(clientId: string | null | undefined): Promise<string | null> {
  if (!clientId) return null;
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new AuthError("Cliënt niet gevonden", 400);
  return client.id;
}

function scheduleFields(input: TodoInput) {
  // A task uses either weekdays, an interval, or a one-off date — never a mix.
  const intervalDays = input.intervalDays ?? null;
  const dueDate = input.dueDate && !input.recurring ? startOfDayUtc(input.dueDate) : null;
  const daysOfWeek = intervalDays ? [] : input.daysOfWeek ?? [];
  return {
    daysOfWeek: formatDaysOfWeek(daysOfWeek),
    intervalDays,
    intervalAnchorDate: intervalDays && input.intervalAnchorDate ? startOfDayUtc(input.intervalAnchorDate.slice(0, 10)) : null,
    showUntil: input.showUntil ? startOfDayUtc(input.showUntil.slice(0, 10)) : null,
    dueDate,
  };
}

function assertDueDateReasonable(dueDate: Date | null, now: Date, existing?: Date | null): void {
  if (!dueDate) return;
  if (existing && existing.getTime() === dueDate.getTime()) return; // unchanged on edit: an overdue task stays editable
  const dayStart = startOfDayUtc(now.toISOString().slice(0, 10)).getTime() - 86_400_000;
  if (dueDate.getTime() < dayStart) throw new AuthError("De einddatum ligt in het verleden", 422);
  if (dueDate.getTime() > now.getTime() + 2 * 365 * 86_400_000) throw new AuthError("De einddatum ligt te ver in de toekomst", 422);
}

export async function createTodo(actor: Actor, input: TodoInput, now: Date = new Date()): Promise<RawTodo> {
  const assignedToId = input.assignedToId || null;
  if (assignedToId && assignedToId !== actor.sub && actor.role === Role.EMPLOYEE) throw new AuthError("Geen toegang", 403);
  if (assignedToId) {
    const assignee = await db.user.findUnique({ where: { id: assignedToId }, select: { active: true } });
    if (!assignee || !assignee.active) throw new AuthError("Medewerker niet gevonden", 400);
  }
  const clientId = await assertClientExists(input.clientId);
  const schedule = scheduleFields(input);
  assertDueDateReasonable(schedule.dueDate, now);

  const todo = await db.todo.create({
    data: {
      title: input.title,
      description: input.description?.trim() || null,
      priority: input.priority,
      ...schedule,
      time: input.time || null,
      recurring: input.recurring ?? false,
      createdById: actor.sub,
      assignedToId,
      room: input.room || null,
      category: input.category ?? null,
      clientId,
      checklist: sealChecklist(mergeChecklist(input.checklist, [])),
    },
    include: TODO_INCLUDE,
  });
  await recordTodoEvent(actor, todo.id, "CREATED");
  await logAudit({ userId: actor.sub, action: "todo.create", targetType: "Todo", targetId: todo.id });
  return todo;
}

export async function updateTodo(actor: Actor, id: string, input: TodoInput, now: Date = new Date()): Promise<RawTodo> {
  // 404 (not 403) for somebody else's personal task: its existence is not theirs to learn.
  const existing = await loadWorkableTodo(actor, id);
  if (!canManageTodo(actor, existing)) throw new AuthError("Geen toegang", 403);

  if (!input.force && input.since != null && input.since !== todoContentVersion(existing)) {
    throw new TodoConflictError(toTodoData(existing));
  }

  const clientId = input.clientId === undefined ? existing.clientId : await assertClientExists(input.clientId);
  const schedule = scheduleFields(input);
  assertDueDateReasonable(schedule.dueDate, now, existing.dueDate);

  const todo = await db.todo.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description?.trim() || null,
      priority: input.priority,
      ...schedule,
      time: input.time || null,
      recurring: input.recurring ?? false,
      // Reassigning isn't supported here: the assignee stays what it was created with.
      room: existing.assignedToId ? input.room || null : undefined,
      category: input.category === undefined ? existing.category : input.category,
      clientId,
      checklist: sealChecklist(mergeChecklist(input.checklist, openChecklist(existing.checklist))),
    },
    include: TODO_INCLUDE,
  });
  await recordTodoEvent(actor, id, "EDITED");
  await logAudit({ userId: actor.sub, action: "todo.update", targetType: "Todo", targetId: id });
  return todo;
}

export async function deleteTodo(actor: Actor, id: string): Promise<void> {
  const existing = await loadWorkableTodo(actor, id);
  if (!canManageTodo(actor, existing)) throw new AuthError("Geen toegang", 403);
  await db.todo.delete({ where: { id } });
  await logAudit({ userId: actor.sub, action: "todo.delete", targetType: "Todo", targetId: id });
}

export async function completeTodo(actor: Actor, id: string, note: string | undefined): Promise<RawTodo> {
  const existing = await loadWorkableTodo(actor, id);
  if (existing.completed) return existing; // idempotent: a double tap or a colleague was faster
  const todo = await db.todo.update({
    where: { id },
    data: { completed: true, completedById: actor.sub, completedAt: new Date(), completionNote: note?.trim() || null, snoozedUntil: null },
    include: TODO_INCLUDE,
  });
  await recordTodoEvent(actor, id, "COMPLETED", note);
  await logAudit({ userId: actor.sub, action: "todo.complete", targetType: "Todo", targetId: id });
  return todo;
}

export async function reopenTodo(actor: Actor, id: string): Promise<RawTodo> {
  const existing = await loadWorkableTodo(actor, id);
  if (!existing.completed) throw new AuthError("Taak is niet afgerond", 400);
  // The next occurrence of a recurring task was already spawned off this
  // completion; reopening this one too would leave two open copies.
  if (existing.regenerated) throw new AuthError("Kan niet meer ongedaan gemaakt worden — de taak is al opnieuw aangemaakt", 409);
  const todo = await db.todo.update({
    where: { id },
    data: { completed: false, completedById: null, completedAt: null, completionNote: null },
    include: TODO_INCLUDE,
  });
  await recordTodoEvent(actor, id, "REOPENED");
  await logAudit({ userId: actor.sub, action: "todo.reopen", targetType: "Todo", targetId: id });
  return todo;
}

/** "Ik pak dit op" / vrijgeven. Taking over a colleague's claim is allowed but explicit (`force`). */
export async function claimTodo(actor: Actor, id: string, action: "claim" | "release", force = false): Promise<RawTodo> {
  const existing = await loadWorkableTodo(actor, id);
  if (existing.assignedToId) throw new AuthError("Een persoonlijke taak kan niet worden opgepakt", 400);
  if (existing.completed) throw new AuthError("Taak is al afgerond", 409);
  if (action === "claim") {
    if (existing.claimedById && existing.claimedById !== actor.sub && !force) {
      throw new AuthError(`${existing.claimedBy?.name ?? "Een collega"} pakt dit al op`, 409);
    }
    if (existing.claimedById === actor.sub) return existing;
  } else {
    if (!existing.claimedById) return existing;
    if (existing.claimedById !== actor.sub && !isSupervisor(actor.role)) throw new AuthError("Alleen degene die de taak oppakt kan hem vrijgeven", 403);
  }
  const todo = await db.todo.update({
    where: { id },
    data: action === "claim" ? { claimedById: actor.sub, claimedAt: new Date() } : { claimedById: null, claimedAt: null },
    include: TODO_INCLUDE,
  });
  await recordTodoEvent(actor, id, action === "claim" ? "CLAIMED" : "RELEASED");
  await logAudit({ userId: actor.sub, action: `todo.${action}`, targetType: "Todo", targetId: id });
  return todo;
}

export async function snoozeTodo(actor: Actor, id: string, until: string | null, now: Date = new Date()): Promise<RawTodo> {
  const existing = await loadWorkableTodo(actor, id);
  if (existing.completed) throw new AuthError("Taak is al afgerond", 409);
  let untilDate: Date | null = null;
  if (until) {
    untilDate = new Date(until);
    const error = validateSnooze(untilDate, now.getTime());
    if (error) throw new AuthError(error, 422);
  }
  const todo = await db.todo.update({ where: { id }, data: { snoozedUntil: untilDate }, include: TODO_INCLUDE });
  await recordTodoEvent(actor, id, untilDate ? "SNOOZED" : "UNSNOOZED");
  await logAudit({ userId: actor.sub, action: untilDate ? "todo.snooze" : "todo.unsnooze", targetType: "Todo", targetId: id });
  return todo;
}

export async function toggleChecklistItem(actor: Actor, id: string, itemId: string, done: boolean): Promise<RawTodo> {
  const existing = await loadWorkableTodo(actor, id);
  if (existing.completed) throw new AuthError("Taak is al afgerond", 409);
  const items = openChecklist(existing.checklist);
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new AuthError("Stap niet gevonden", 404);
  if (item.done === done) return existing;
  item.done = done;
  return db.todo.update({ where: { id }, data: { checklist: sealChecklist(items) }, include: TODO_INCLUDE });
}

export async function commentOnTodo(actor: Actor, id: string, comment: string): Promise<void> {
  await loadWorkableTodo(actor, id);
  await recordTodoEvent(actor, id, "COMMENT", comment);
  await logAudit({ userId: actor.sub, action: "todo.comment", targetType: "Todo", targetId: id });
}

/** Bulk complete / snooze on shared tasks. Returns the ids that actually changed. */
export async function bulkTodos(actor: Actor, action: "complete" | "snooze", ids: string[], until?: string, now: Date = new Date()): Promise<string[]> {
  if (!isSupervisor(actor.role)) throw new AuthError("Geen toegang", 403);
  let untilDate: Date | null = null;
  if (action === "snooze") {
    untilDate = new Date(until ?? "");
    const error = validateSnooze(untilDate, now.getTime());
    if (error) throw new AuthError(error, 422);
  }
  // Shared and still open only: a personal task is completed from its owner's
  // screen, and completed:false guards against re-stamping completedAt.
  const rows = await db.todo.findMany({ where: { id: { in: ids }, assignedToId: null, completed: false }, select: { id: true } });
  const target = rows.map((r) => r.id);
  if (target.length === 0) return [];
  await db.todo.updateMany({
    where: { id: { in: target } },
    data: action === "complete" ? { completed: true, completedById: actor.sub, completedAt: now, snoozedUntil: null } : { snoozedUntil: untilDate },
  });
  await db.todoEvent.createMany({
    data: target.map((todoId) => ({ todoId, userId: actor.sub, type: action === "complete" ? ("COMPLETED" as const) : ("SNOOZED" as const) })),
  });
  await logAudit({ userId: actor.sub, action: action === "complete" ? "todo.bulk_complete" : "todo.bulk_snooze", targetType: "Todo", targetId: target.join(",") });
  return target;
}
