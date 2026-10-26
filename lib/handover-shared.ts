// Client-safe half of the Overdracht module: labels, types and pure helpers
// that both the server routes and the browser components use. Deliberately
// no "server-only" and no Prisma runtime import — the database part lives
// in lib/handover.ts.

export const HANDOVER_CATEGORIES = ["ALGEMEEN", "GEDRAG", "GEZONDHEID", "MEDICATIE", "VEILIGHEID", "SOCIAAL", "PRAKTISCH"] as const;
export type HandoverCategoryKey = (typeof HANDOVER_CATEGORIES)[number];

export const HANDOVER_PRIORITIES = ["INFO", "AANDACHT", "URGENT"] as const;
export type HandoverPriorityKey = (typeof HANDOVER_PRIORITIES)[number];

export const HANDOVER_CATEGORY_META: Record<HandoverCategoryKey, { label: string; hint: string }> = {
  ALGEMEEN: { label: "Algemeen", hint: "Alles wat nergens anders onder valt" },
  GEDRAG: { label: "Gedrag & stemming", hint: "Onrust, agressie, stemming, slaap" },
  GEZONDHEID: { label: "Gezondheid", hint: "Klachten, pijn, eten en drinken, verzorging" },
  MEDICATIE: { label: "Medicatie", hint: "Inname, weigering, bijwerkingen, voorraad" },
  VEILIGHEID: { label: "Veiligheid", hint: "Risico's, valgevaar, weglopen, incidenten" },
  SOCIAAL: { label: "Familie & contact", hint: "Bezoek, telefoon, afspraken met naasten" },
  PRAKTISCH: { label: "Praktisch", hint: "Afspraken, boodschappen, onderhoud, klusjes" },
};

export const HANDOVER_PRIORITY_META: Record<HandoverPriorityKey, { label: string; hint: string; rank: number }> = {
  URGENT: { label: "Urgent", hint: "Direct oppakken bij het begin van de dienst", rank: 0 },
  AANDACHT: { label: "Let op", hint: "Belangrijk om vandaag in de gaten te houden", rank: 1 },
  INFO: { label: "Ter info", hint: "Goed om te weten", rank: 2 },
};

/** The author (or an admin) may still correct or withdraw a note within this window. */
export const HANDOVER_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const HANDOVER_MAX_CONTENT = 5000;

/** A note as the browser sees it: already scoped to what the viewer may see. */
export type HandoverNote = {
  id: string;
  content: string;
  shift: "MORNING" | "EVENING" | "NIGHT";
  category: HandoverCategoryKey;
  priority: HandoverPriorityKey;
  needsAction: boolean;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  expiresAt: string;
  editedAt: string | null;
  clientId: string | null;
  /** Display label for the client. */
  clientName: string | null;
  /** Client's room, "Geen kamer" if the client has none, or null for a general note. */
  room: string | null;
  /** Colleagues that marked the note as read. */
  readBy: { userId: string; name: string; at: string }[];
  readByMe: boolean;
  /** Whether the viewer may still edit/remove it (author within 24h, or an admin). */
  canEdit: boolean;
};

export function isOpenAction(note: Pick<HandoverNote, "needsAction" | "resolvedAt">): boolean {
  return note.needsAction && !note.resolvedAt;
}

export function isUnread(note: Pick<HandoverNote, "readByMe" | "authorId">, viewerId: string): boolean {
  // Your own notes are read by definition.
  return !note.readByMe && note.authorId !== viewerId;
}

/**
 * Triage order for the incoming shift: open urgent items first, then by
 * priority, unresolved before resolved, and newest first within that.
 */
export function compareHandovers(
  a: Pick<HandoverNote, "priority" | "needsAction" | "resolvedAt" | "createdAt">,
  b: Pick<HandoverNote, "priority" | "needsAction" | "resolvedAt" | "createdAt">
): number {
  const done = (n: typeof a) => (n.needsAction && n.resolvedAt ? 1 : 0);
  if (done(a) !== done(b)) return done(a) - done(b);
  const pr = HANDOVER_PRIORITY_META[a.priority].rank - HANDOVER_PRIORITY_META[b.priority].rank;
  if (pr !== 0) return pr;
  const open = (n: typeof a) => (n.needsAction && !n.resolvedAt ? 0 : 1);
  if (open(a) !== open(b)) return open(a) - open(b);
  return b.createdAt.localeCompare(a.createdAt);
}

export function canEditHandover(
  note: { userId: string; createdAt: Date | string },
  viewer: { userId: string; isAdmin: boolean },
  now: Date = new Date()
): boolean {
  if (viewer.isAdmin) return true;
  if (note.userId !== viewer.userId) return false;
  return now.getTime() - new Date(note.createdAt).getTime() <= HANDOVER_EDIT_WINDOW_MS;
}

// --- Shift overview ("Dienstoverzicht") ------------------------------------
// A deterministic digest compiled from live data.

export type DigestTone = "red" | "amber" | "slate";

export type DigestItem = {
  id: string;
  text: string;
  detail?: string;
  /** Display label of the client; null for group-wide items. */
  subject: string | null;
  href: string;
  tone: DigestTone;
};

export type DigestSectionKey = "first" | "actions" | "medication" | "interventions" | "appointments";

export type DigestSection = {
  key: DigestSectionKey;
  title: string;
  /** Total number of items, which can exceed items.length when the list is capped. */
  total: number;
  items: DigestItem[];
};

export type HandoverDigest = {
  generatedAt: string;
  sections: DigestSection[];
};
