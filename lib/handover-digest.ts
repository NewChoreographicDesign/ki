import "server-only";
import { db } from "@/lib/db";
import { fullName, formatTime, shiftLabel } from "@/lib/utils";
import { HANDOVER_CATEGORY_META, isOpenAction, type DigestItem, type DigestSection, type HandoverDigest, type HandoverNote } from "@/lib/handover-shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const SECTION_CAP = 8;

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function section(key: DigestSection["key"], title: string, all: DigestItem[]): DigestSection {
  return { key, title, total: all.length, items: all.slice(0, SECTION_CAP) };
}

function subjectOf(note: HandoverNote): string | null {
  if (!note.clientName) return null;
  return note.room && note.room !== note.clientName && note.room !== "Geen kamer" ? `${note.room} · ${note.clientName}` : note.clientName;
}

/**
 * Compiles what the incoming shift has to know from live data — the
 * handover notes plus medication that was not taken, open interventions and
 * the agenda of the next 24 hours. ki has no incident-management (VMS)
 * module, so unlike Multi-Woongroep's version there is no "open meldingen"
 * section here.
 */
export async function collectHandoverDigest(notes: HandoverNote[], now: Date = new Date()): Promise<HandoverDigest> {
  const until = new Date(now.getTime() + DAY_MS);

  const [notTaken, interventions, appointments] = await Promise.all([
    db.medicationCheck.findMany({
      where: { status: "NOT_TAKEN", checkedAt: { gte: new Date(now.getTime() - DAY_MS) } },
      select: {
        id: true,
        checkedAt: true,
        comment: true,
        medication: { select: { name: true, client: { select: { firstName: true, lastName: true, room: true } } } },
      },
      orderBy: { checkedAt: "desc" },
      take: 25,
    }),
    db.intervention.findMany({
      where: { status: "OPEN" },
      select: { id: true, goal: true, wholeGroup: true, clients: { select: { client: { select: { firstName: true, lastName: true, room: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.appointment.findMany({
      where: { startAt: { gte: now, lt: until }, status: "PLANNED" },
      select: { id: true, title: true, startAt: true, client: { select: { firstName: true, lastName: true, room: true } } },
      orderBy: { startAt: "asc" },
      take: 25,
    }),
  ]);

  // 1. First things first: open urgent notes, then "let op" notes.
  const first = notes
    .filter((n) => !n.resolvedAt && (n.priority === "URGENT" || n.priority === "AANDACHT"))
    .map((n): DigestItem => ({
      id: n.id,
      text: clip(n.content, 220),
      detail: `${HANDOVER_CATEGORY_META[n.category].label} · ${shiftLabel(n.shift)} · ${n.authorName}`,
      subject: subjectOf(n),
      href: "/overdracht",
      tone: n.priority === "URGENT" ? "red" : "amber",
    }));

  // 2. Actions somebody still has to do.
  const actions = notes.filter(isOpenAction).map((n): DigestItem => ({
    id: n.id,
    text: clip(n.content, 220),
    detail: `${n.authorName} · ${formatTime(new Date(n.createdAt))}`,
    subject: subjectOf(n),
    href: "/overdracht",
    tone: n.priority === "URGENT" ? "red" : "amber",
  }));

  const medicationItems: DigestItem[] = notTaken.map((c) => ({
    id: c.id,
    text: `${c.medication.name} niet ingenomen`,
    detail: `${formatTime(c.checkedAt)}${c.comment ? ` · ${clip(c.comment, 100)}` : ""}`,
    subject: fullName(c.medication.client),
    href: "/medicatie",
    tone: "amber",
  }));

  const interventionItems = interventions.map((i): DigestItem => ({
    id: i.id,
    text: clip(i.goal, 160),
    subject: i.wholeGroup ? "Hele groep" : i.clients.length === 1 ? fullName(i.clients[0].client) : `${i.clients.length} cliënten`,
    href: "/overdracht",
    tone: "slate",
  }));

  const appointmentItems = appointments.map((a): DigestItem => ({
    id: a.id,
    text: a.title,
    detail: formatTime(a.startAt),
    subject: a.client ? fullName(a.client) : null,
    href: "/agenda",
    tone: "slate",
  }));

  return {
    generatedAt: now.toISOString(),
    sections: [
      section("first", "Eerst oppakken", first),
      section("actions", "Openstaande acties", actions),
      section("medication", "Medicatie", medicationItems),
      section("interventions", "Lopende interventies", interventionItems),
      section("appointments", "Agenda komende 24 uur", appointmentItems),
    ],
  };
}
