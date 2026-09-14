import { parseMedicationTimes, formatTime, fullName } from "@/lib/utils";

export type MedicationOverviewCheck = {
  id: string;
  checkedAt: Date;
  status: string;
  userName: string;
};

export type MedicationOverviewRow = {
  clientId: string;
  clientName: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  asNeeded: boolean;
  slots: { time: string; check: MedicationOverviewCheck | null }[];
  /** Earliest still-open slot time today, or null once every slot is done (or for an asNeeded medication, which is never "done"). */
  nextOpenTime: string | null;
  doneForToday: boolean;
};

/**
 * Builds one overview row for a single medication, given today's checks
 * already sorted ascending by checkedAt. Mirrors the same "earliest check
 * fills the earliest scheduled time" pairing used by the reminder banner
 * (lib/medication-reminders.ts) and the client's own medicatie page
 * (app/(app)/medicatie/[clientId]/page.tsx) — a check isn't linked to a
 * specific slot, so all three places need to agree on how they're paired.
 */
export function buildMedicationOverviewRow(
  client: { id: string; firstName: string; lastName: string },
  medication: { id: string; name: string; dosage: string; times: string; asNeeded: boolean },
  todaysChecksAsc: MedicationOverviewCheck[]
): MedicationOverviewRow {
  let slots: MedicationOverviewRow["slots"];
  let nextOpenTime: string | null;
  let doneForToday: boolean;

  if (medication.asNeeded) {
    // No fixed schedule to be "done" against — always open, so it never
    // sinks to the bottom of the not-done list the way a completed
    // scheduled medication does.
    slots = todaysChecksAsc.map((check) => ({ time: formatTime(check.checkedAt), check }));
    nextOpenTime = null;
    doneForToday = false;
  } else {
    const times = parseMedicationTimes(medication.times);
    slots = times.map((time, i) => ({ time, check: todaysChecksAsc[i] ?? null }));
    const openSlot = slots.find((s) => s.check === null);
    nextOpenTime = openSlot ? openSlot.time : null;
    doneForToday = !openSlot;
  }

  return {
    clientId: client.id,
    clientName: fullName(client),
    medicationId: medication.id,
    medicationName: medication.name,
    dosage: medication.dosage,
    asNeeded: medication.asNeeded,
    slots,
    nextOpenTime,
    doneForToday,
  };
}

export type MedicationRoomGroup = {
  room: string;
  /** Fixed-time medications: still-open ones first (earliest next time first), completed ones sunk to the bottom. */
  scheduled: MedicationOverviewRow[];
  /** "Indien nodig" medications, which have no time to sort by — listed separately, alphabetically. */
  asNeeded: MedicationOverviewRow[];
};

/** The scheduled-list sort key: next open time while there's one due, otherwise the medication's last scheduled time (so the "done" group still reads earliest-to-latest, just below every still-open one). */
function sortKey(row: MedicationOverviewRow): string {
  if (!row.doneForToday) return row.nextOpenTime ?? "99:99";
  const last = row.slots[row.slots.length - 1];
  return last ? last.time : "99:99";
}

/**
 * Groups medication rows by room (same "Geen kamer" fallback and ordering
 * convention as groupMedicationChecksByRoomAndDay in lib/weekly-report.ts),
 * and within each room sorts scheduled medications so the next one due is
 * always on top — a medication that's just been registered (afgevinkt,
 * verlof, or niet ingenomen) drops out of contention for "next due" and
 * sinks toward the bottom of that room's list.
 */
export function groupMedicationOverviewByRoom(
  rows: (MedicationOverviewRow & { room: string | null })[]
): MedicationRoomGroup[] {
  const byRoom = new Map<string, (MedicationOverviewRow & { room: string | null })[]>();
  for (const row of rows) {
    const room = row.room || "Geen kamer";
    const list = byRoom.get(room);
    if (list) list.push(row);
    else byRoom.set(room, [row]);
  }

  const rank = (room: string) => (room === "Geen kamer" ? 1 : 0);

  return Array.from(byRoom.entries())
    .map(([room, roomRows]) => {
      const scheduled = roomRows
        .filter((r) => !r.asNeeded)
        .sort(
          (a, b) =>
            Number(a.doneForToday) - Number(b.doneForToday) ||
            sortKey(a).localeCompare(sortKey(b)) ||
            a.medicationName.localeCompare(b.medicationName)
        );
      const asNeeded = roomRows
        .filter((r) => r.asNeeded)
        .sort((a, b) => a.medicationName.localeCompare(b.medicationName));
      return { room, scheduled, asNeeded };
    })
    .sort((a, b) => rank(a.room) - rank(b.room) || a.room.localeCompare(b.room));
}
