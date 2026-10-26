import "server-only";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/log";
import {
  ackStateFor,
  fingerprint,
  findDuplicates,
  findInteractions,
  pairKey,
  parseInteractionCsv,
  requiresAck,
  type AckState,
  type InteractionRule,
  type MedForCheck,
} from "@/lib/medication-interactions";

// Database side of the interaction check. DrugInteraction/InteractionDataset
// are a single shared reference table (this app has one organisation, so
// there is no "per group" to scope them to); a client's own medication and
// acknowledgements are plain db reads/writes like everything else here.

export type ImportResult = { imported: number; skipped: number; errors: string[]; maxSeverity: number; ackFromRank: number };

/** Replaces the interaction extract with a new one. `ackFromRank` defaults to the highest severity in the file. */
export async function importInteractions(params: { csv: string; source: string; version: string; ackFromRank?: number }): Promise<ImportResult> {
  const { rows, errors } = parseInteractionCsv(params.csv);
  if (rows.length === 0) return { imported: 0, skipped: errors.length, errors: errors.length ? errors : ["Geen rijen gevonden"], maxSeverity: 0, ackFromRank: 0 };
  const maxSeverity = Math.max(...rows.map((r) => r.severity));
  const ackFromRank = params.ackFromRank ?? maxSeverity;
  await db.$transaction([
    db.drugInteraction.deleteMany({}),
    db.drugInteraction.createMany({ data: rows.map((r) => ({ atcA: r.atcA, atcB: r.atcB, severity: r.severity, label: r.label, text: r.text, source: params.source })) }),
    db.interactionDataset.deleteMany({}),
    db.interactionDataset.create({ data: { source: params.source, version: params.version, rowCount: rows.length, maxSeverity, ackFromRank } }),
  ]);
  return { imported: rows.length, skipped: errors.length, errors, maxSeverity, ackFromRank };
}

export async function getDataset() {
  return db.interactionDataset.findFirst({ orderBy: { importedAt: "desc" } });
}

/** Every proper prefix of at least 3 characters of each ATC code: the only rule codes that can match. */
function prefixesOf(codes: string[]): string[] {
  const out = new Set<string>();
  for (const code of codes) for (let n = 3; n <= code.length; n++) out.add(code.slice(0, n));
  return [...out];
}

async function loadRulesFor(codes: string[]): Promise<InteractionRule[]> {
  const prefixes = prefixesOf(codes);
  if (prefixes.length === 0) return [];
  const rows = await db.drugInteraction.findMany({ where: { OR: [{ atcA: { in: prefixes } }, { atcB: { in: prefixes } }] } });
  return rows.map((r) => ({ atcA: r.atcA, atcB: r.atcB, severity: r.severity, label: r.label, text: r.text, source: r.source }));
}

export type CheckItem = {
  kind: "INTERACTION" | "DUPLICATE";
  medicationA: { id: string; name: string };
  medicationB: { id: string; name: string };
  severity: number | null;
  label: string | null;
  texts: string[];
  sameSubstance?: boolean;
  needsAck: boolean;
  ack: AckState;
};

export type ClientCheck = {
  /** Null = no interaction data imported: the UI then shows only that fact. */
  dataset: { source: string; version: string; importedAt: Date; ackFromRank: number; maxSeverity: number } | null;
  items: CheckItem[];
  /** Pairs at or above the acknowledgement rank that nobody has looked at (or changed since). */
  openAcks: number;
};

export async function medicationsForCheck(clientId: string): Promise<MedForCheck[]> {
  const rows = await db.medication.findMany({ where: { clientId, active: true } });
  return rows.map((m) => ({ id: m.id, name: m.name, atcCode: m.atcCode, hpkCode: null, dosage: m.dosage, times: m.times, active: m.active, asNeeded: m.asNeeded }));
}

export async function checkClient(clientId: string): Promise<ClientCheck> {
  const dataset = await getDataset();
  if (!dataset) return { dataset: null, items: [], openAcks: 0 };
  const [meds, ackRows] = await Promise.all([
    medicationsForCheck(clientId),
    db.interactionAck.findMany({ where: { clientId }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const acks = ackRows.map((a) => ({ kind: a.kind, medicationA: a.medicationA, medicationB: a.medicationB, fingerprint: a.fingerprint, reason: a.reason, userName: a.user.name, createdAt: a.createdAt }));
  const codes = meds.map((m) => (m.atcCode ?? "").trim().toUpperCase()).filter(Boolean);
  const rules = await loadRulesFor(codes);

  const items: CheckItem[] = [];
  for (const pair of findInteractions(meds, rules)) {
    const needsAck = requiresAck(pair.severity, dataset.ackFromRank);
    items.push({
      kind: "INTERACTION",
      medicationA: { id: pair.medicationA.id, name: pair.medicationA.name },
      medicationB: { id: pair.medicationB.id, name: pair.medicationB.name },
      severity: pair.severity,
      label: pair.rules[0]?.label ?? null,
      texts: pair.rules.map((r) => r.text),
      needsAck,
      ack: ackStateFor("INTERACTION", pair.medicationA, pair.medicationB, acks),
    });
  }
  for (const pair of findDuplicates(meds)) {
    items.push({
      kind: "DUPLICATE",
      medicationA: { id: pair.medicationA.id, name: pair.medicationA.name },
      medicationB: { id: pair.medicationB.id, name: pair.medicationB.name },
      severity: null,
      label: null,
      texts: [],
      sameSubstance: pair.sameSubstance,
      needsAck: false,
      ack: ackStateFor("DUPLICATE", pair.medicationA, pair.medicationB, acks),
    });
  }
  return {
    dataset: { source: dataset.source, version: dataset.version, importedAt: dataset.importedAt, ackFromRank: dataset.ackFromRank, maxSeverity: dataset.maxSeverity },
    items,
    openAcks: items.filter((i) => i.needsAck && i.ack.state !== "ACKNOWLEDGED").length,
  };
}

/** The check as part of a save response: never allowed to fail or block the save itself. */
export async function checkClientSafely(clientId: string): Promise<ClientCheck | null> {
  try {
    return await checkClient(clientId);
  } catch (error) {
    logger.error("medication_interactions.check_failed", { clientId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export class AckError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Records "reviewed by": only for a pair that is flagged right now, for the exact current state of both medications. */
export async function acknowledgePair(params: { userId: string; clientId: string; kind: "INTERACTION" | "DUPLICATE"; medicationA: string; medicationB: string; reason: string }) {
  const reason = params.reason.trim();
  if (reason.length < 3) throw new AckError("Geef een reden op");
  const check = await checkClient(params.clientId);
  const key = pairKey(params.medicationA, params.medicationB);
  const item = check.items.find((i) => i.kind === params.kind && pairKey(i.medicationA.id, i.medicationB.id) === key);
  if (!item) throw new AckError("Deze combinatie wordt niet (meer) gesignaleerd", 404);
  const meds = await medicationsForCheck(params.clientId);
  const a = meds.find((m) => m.id === item.medicationA.id)!;
  const b = meds.find((m) => m.id === item.medicationB.id)!;
  const ack = await db.interactionAck.create({
    data: {
      clientId: params.clientId,
      kind: params.kind,
      medicationA: a.id < b.id ? a.id : b.id,
      medicationB: a.id < b.id ? b.id : a.id,
      fingerprint: fingerprint(params.kind, a, b),
      severity: item.severity,
      reason,
      userId: params.userId,
    },
  });
  await logAudit({ userId: params.userId, action: `medication_interaction.ack:${params.kind}`, targetType: "InteractionAck", targetId: ack.id });
  return ack;
}
