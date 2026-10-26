import { createHash } from "node:crypto";

// Interaction and duplicate-therapy check — pure rules over data that came
// from a LICENSED extract (DrugInteraction). This app contains no interaction
// knowledge of its own: with no extract imported there is nothing to show.
// The result is decision support for the person who adds or changes a
// medication; a prescriber or pharmacist decides. Not a medical device.

export type MedForCheck = {
  id: string;
  name: string;
  atcCode: string | null;
  hpkCode: string | null;
  dosage: string | null;
  times: string;
  active: boolean;
  asNeeded: boolean;
};

export type InteractionRule = { atcA: string; atcB: string; severity: number; label: string | null; text: string; source: string };

/** Class codes in an extract shorter than ATC level 2 (3 characters) would match half the formulary; they are rejected at import. */
export const MIN_ATC_PREFIX = 3;
/** ATC level 4 (chemical subgroup, 5 characters) is what "same class" means for a duplicate. */
export const DUPLICATE_ATC_LEVEL = 5;
const FULL_ATC_LENGTH = 7;

const atc = (value: string | null | undefined): string => (value ?? "").trim().toUpperCase().replace(/\s+/g, "");

/** A medication matches a rule code when its ATC code equals it or starts with it (a class code). */
export function atcMatches(medicationAtc: string | null, ruleAtc: string): boolean {
  const med = atc(medicationAtc);
  const rule = atc(ruleAtc);
  return rule.length >= MIN_ATC_PREFIX && med.length >= rule.length && med.startsWith(rule);
}

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export type InteractionPair = {
  kind: "INTERACTION";
  medicationA: MedForCheck;
  medicationB: MedForCheck;
  /** Highest severity of the matching rows. */
  severity: number;
  rules: InteractionRule[];
};

export type DuplicatePair = {
  kind: "DUPLICATE";
  medicationA: MedForCheck;
  medicationB: MedForCheck;
  /** Same substance (identical 7-character ATC code) or only the same subgroup. */
  sameSubstance: boolean;
  sharedAtc: string;
};

const MAX_RULES_PER_PAIR = 5;

function orderedPairs(meds: MedForCheck[]): [MedForCheck, MedForCheck][] {
  const usable = meds.filter((m) => m.active && atc(m.atcCode)).sort((a, b) => a.id.localeCompare(b.id));
  const pairs: [MedForCheck, MedForCheck][] = [];
  for (let i = 0; i < usable.length; i++) for (let j = i + 1; j < usable.length; j++) pairs.push([usable[i], usable[j]]);
  return pairs;
}

/** Pairs of the client's active medication that a rule of the extract applies to, symmetric and de-duplicated. */
export function findInteractions(meds: MedForCheck[], rules: InteractionRule[]): InteractionPair[] {
  const out: InteractionPair[] = [];
  for (const [a, b] of orderedPairs(meds)) {
    const matching = rules.filter((r) => (atcMatches(a.atcCode, r.atcA) && atcMatches(b.atcCode, r.atcB)) || (atcMatches(a.atcCode, r.atcB) && atcMatches(b.atcCode, r.atcA)));
    if (matching.length === 0) continue;
    const sorted = [...matching].sort((x, y) => y.severity - x.severity);
    out.push({ kind: "INTERACTION", medicationA: a, medicationB: b, severity: sorted[0].severity, rules: sorted.slice(0, MAX_RULES_PER_PAIR) });
  }
  return out.sort((x, y) => y.severity - x.severity || x.medicationA.name.localeCompare(y.medicationA.name, "nl"));
}

/** Two active medications of the same ATC level-4 subgroup: possible double therapy. */
export function findDuplicates(meds: MedForCheck[]): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (const [a, b] of orderedPairs(meds)) {
    const x = atc(a.atcCode);
    const y = atc(b.atcCode);
    if (x.length < DUPLICATE_ATC_LEVEL || y.length < DUPLICATE_ATC_LEVEL) continue;
    if (x.slice(0, DUPLICATE_ATC_LEVEL) !== y.slice(0, DUPLICATE_ATC_LEVEL)) continue;
    out.push({ kind: "DUPLICATE", medicationA: a, medicationB: b, sameSubstance: x.length >= FULL_ATC_LENGTH && x === y, sharedAtc: x.slice(0, DUPLICATE_ATC_LEVEL) });
  }
  return out;
}

/**
 * The state of a medication that an acknowledgement is valid for. Any change
 * to it (dose, times, codes, name, deactivation) gives a new fingerprint, so
 * the pair is asked about again.
 */
export function fingerprint(kind: "INTERACTION" | "DUPLICATE", a: MedForCheck, b: MedForCheck): string {
  const part = (m: MedForCheck) => [m.id, m.name, atc(m.atcCode), atc(m.hpkCode), (m.dosage ?? "").trim(), m.times, m.active ? 1 : 0, m.asNeeded ? 1 : 0].join("~");
  const [first, second] = a.id < b.id ? [a, b] : [b, a];
  return createHash("sha256").update(`${kind}\n${part(first)}\n${part(second)}`).digest("hex").slice(0, 32);
}

export type AckRecord = { kind: string; medicationA: string; medicationB: string; fingerprint: string; reason: string; userName: string; createdAt: Date };

export type AckState =
  | { state: "ACKNOWLEDGED"; reason: string; userName: string; at: Date }
  /** Acknowledged before, but a medication changed since: it must be looked at again. */
  | { state: "CHANGED"; previousAt: Date }
  | { state: "OPEN" };

export function ackStateFor(kind: "INTERACTION" | "DUPLICATE", a: MedForCheck, b: MedForCheck, acks: AckRecord[]): AckState {
  const key = pairKey(a.id, b.id);
  const mine = acks.filter((x) => x.kind === kind && pairKey(x.medicationA, x.medicationB) === key).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
  if (mine.length === 0) return { state: "OPEN" };
  const current = fingerprint(kind, a, b);
  const valid = mine.find((x) => x.fingerprint === current);
  if (valid) return { state: "ACKNOWLEDGED", reason: valid.reason, userName: valid.userName, at: valid.createdAt };
  return { state: "CHANGED", previousAt: mine[0].createdAt };
}

/** Only the top of the extract's own severity scale asks for an acknowledgement. */
export const requiresAck = (severity: number, ackFromRank: number): boolean => severity >= ackFromRank;

// --- CSV contract of the licensed extract ------------------------------------------------

export type ParsedInteractionRow = { atcA: string; atcB: string; severity: number; label: string | null; text: string };

function splitLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else quoted = false;
      } else current += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      fields.push(current);
      current = "";
    } else current += c;
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

const MAX_ROWS = 500_000;

/**
 * Header (case-insensitive, any order, ';' separated): atcA, atcB, severity,
 * text, and optionally label. `severity` is the extract's own integer rank,
 * higher = more severe; this app never maps text to a scale. A bad row is
 * reported and skipped, never guessed.
 */
export function parseInteractionCsv(content: string): { rows: ParsedInteractionRow[]; errors: string[] } {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: ["Leeg bestand"] };
  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iA = idx(["atca"]);
  const iB = idx(["atcb"]);
  const iS = idx(["severity", "ernst"]);
  const iT = idx(["text", "tekst"]);
  const iL = idx(["label"]);
  const missing = [["atcA", iA], ["atcB", iB], ["severity", iS], ["text", iT]].filter(([, i]) => i === -1).map(([n]) => n);
  if (missing.length) return { rows: [], errors: [`Kolom(men) ontbreken in de header: ${missing.join(", ")}`] };

  const rows: ParsedInteractionRow[] = [];
  const errors: string[] = [];
  lines.slice(1, 1 + MAX_ROWS).forEach((line, n) => {
    const f = splitLine(line);
    const a = atc(f[iA]);
    const b = atc(f[iB]);
    const sev = f[iS];
    const text = f[iT];
    const where = `Regel ${n + 2}`;
    if (a.length < MIN_ATC_PREFIX || !/^[A-Z][0-9A-Z]+$/.test(a) || b.length < MIN_ATC_PREFIX || !/^[A-Z][0-9A-Z]+$/.test(b)) {
      errors.push(`${where}: ongeldige ATC-code (minimaal ${MIN_ATC_PREFIX} tekens), overgeslagen`);
    } else if (!/^\d{1,3}$/.test(sev ?? "")) {
      errors.push(`${where}: severity moet een geheel getal zijn, overgeslagen`);
    } else if (!text) {
      errors.push(`${where}: tekst ontbreekt, overgeslagen`);
    } else {
      rows.push({ atcA: a, atcB: b, severity: Number(sev), label: iL >= 0 ? f[iL] || null : null, text });
    }
  });
  if (lines.length - 1 > MAX_ROWS) errors.push(`Bestand had meer dan ${MAX_ROWS} regels — rest is niet verwerkt`);
  return { rows, errors };
}

export const DECISION_SUPPORT_NOTICE =
  "Beslissingsondersteuning, geen medisch hulpmiddel. Een voorschrijver of apotheker beslist.";
