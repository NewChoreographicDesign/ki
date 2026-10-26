import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { canEditHandover, compareHandovers, type HandoverNote } from "@/lib/handover-shared";

const DAY_MS = 24 * 60 * 60 * 1000;
export const HANDOVER_RETENTION_DAYS = 7;
/** An unresolved action note stays visible past its expiry, but never longer than this after creation. */
export const HANDOVER_MAX_OPEN_DAYS = 30;

export function handoverExpiry(now: Date): Date {
  return new Date(now.getTime() + HANDOVER_RETENTION_DAYS * DAY_MS);
}

/** Unresolved action notes outlive their expiry, but only up to HANDOVER_MAX_OPEN_DAYS after creation. */
function stillOpenAction(now: Date): Prisma.HandoverWhereInput {
  return { needsAction: true, resolvedAt: null, createdAt: { gt: new Date(now.getTime() - HANDOVER_MAX_OPEN_DAYS * DAY_MS) } };
}

export function handoverVisibleWhere(now: Date = new Date()): Prisma.HandoverWhereInput {
  return { OR: [{ expiresAt: { gt: now } }, stillOpenAction(now)] };
}

/** What gets swept on write: expired, and not an action somebody still has to do. */
export function handoverPurgeWhere(now: Date = new Date()): Prisma.HandoverWhereInput {
  return { expiresAt: { lt: now }, NOT: stillOpenAction(now) };
}

export const HANDOVER_INCLUDE = {
  user: { select: { id: true, name: true } },
  client: { select: { id: true, firstName: true, lastName: true, room: true } },
  resolvedBy: { select: { name: true } },
  acks: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.HandoverInclude;

export type HandoverRowWithRelations = Prisma.HandoverGetPayload<{ include: typeof HANDOVER_INCLUDE }>;

export type HandoverViewer = { userId: string; role: Role };

export function toHandoverNote(row: HandoverRowWithRelations, viewer: HandoverViewer, now: Date = new Date()): HandoverNote {
  const isAdmin = viewer.role === "ADMIN";
  return {
    id: row.id,
    content: row.content,
    shift: row.shift,
    category: row.category,
    priority: row.priority,
    needsAction: row.needsAction,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedByName: row.resolvedBy?.name ?? null,
    resolutionNote: row.resolutionNote,
    authorId: row.user.id,
    authorName: row.user.name,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    clientId: row.client?.id ?? null,
    clientName: row.client ? `${row.client.firstName} ${row.client.lastName}` : null,
    room: row.client ? row.client.room || "Geen kamer" : null,
    readBy: row.acks.map((a) => ({ userId: a.userId, name: a.user.name, at: a.createdAt.toISOString() })),
    readByMe: row.acks.some((a) => a.userId === viewer.userId),
    canEdit: canEditHandover({ userId: row.userId, createdAt: row.createdAt }, { userId: viewer.userId, isAdmin }, now),
  };
}

/** Every note currently visible, triaged (urgent / open first). */
export async function loadHandoverNotes(viewer: HandoverViewer, now: Date = new Date()): Promise<HandoverNote[]> {
  const rows = await db.handover.findMany({
    where: handoverVisibleWhere(now),
    include: HANDOVER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toHandoverNote(r, viewer, now)).sort(compareHandovers);
}
