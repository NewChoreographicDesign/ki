import { describe, it, expect } from "vitest";
import { buildMedicationOverviewRow, groupMedicationOverviewByRoom } from "@/lib/medication-schedule";
import { amsterdamDate } from "@/lib/utils";

const client = { id: "c1", firstName: "Jan", lastName: "Bakker" };

describe("buildMedicationOverviewRow", () => {
  it("reports the earliest not-yet-done time when no checks exist yet", () => {
    const med = { id: "m1", name: "Paracetamol", dosage: "500mg", times: "20:00,08:00", asNeeded: false };
    const row = buildMedicationOverviewRow(client, med, []);
    expect(row.nextOpenTime).toBe("08:00");
    expect(row.doneForToday).toBe(false);
  });

  it("pairs the earliest check with the earliest scheduled time", () => {
    const med = { id: "m1", name: "Paracetamol", dosage: "500mg", times: "08:00,20:00", asNeeded: false };
    const checks = [
      { id: "chk1", checkedAt: amsterdamDate(2026, 1, 5, 8, 5), status: "TAKEN", userName: "Anna" },
    ];
    const row = buildMedicationOverviewRow(client, med, checks);
    expect(row.slots[0].check?.id).toBe("chk1");
    expect(row.nextOpenTime).toBe("20:00");
    expect(row.doneForToday).toBe(false);
  });

  it("is done for today once every scheduled time has a check", () => {
    const med = { id: "m1", name: "Paracetamol", dosage: "500mg", times: "08:00", asNeeded: false };
    const checks = [
      { id: "chk1", checkedAt: amsterdamDate(2026, 1, 5, 8, 5), status: "TAKEN", userName: "Anna" },
    ];
    const row = buildMedicationOverviewRow(client, med, checks);
    expect(row.doneForToday).toBe(true);
    expect(row.nextOpenTime).toBeNull();
  });

  it("never reports an asNeeded medication as done, regardless of checks", () => {
    const med = { id: "m1", name: "Paracetamol", dosage: "500mg", times: "", asNeeded: true };
    const checks = [
      { id: "chk1", checkedAt: amsterdamDate(2026, 1, 5, 8, 5), status: "TAKEN", userName: "Anna" },
    ];
    const row = buildMedicationOverviewRow(client, med, checks);
    expect(row.doneForToday).toBe(false);
    expect(row.nextOpenTime).toBeNull();
  });
});

function row(overrides: Partial<ReturnType<typeof buildMedicationOverviewRow>> & { room: string | null }) {
  return {
    clientId: "c1",
    clientName: "Jan Bakker",
    medicationId: "m",
    dosage: "",
    asNeeded: false,
    slots: [],
    nextOpenTime: null,
    doneForToday: false,
    medicationName: "Med",
    ...overrides,
  };
}

describe("groupMedicationOverviewByRoom", () => {
  it("sorts open medications earliest-first and sinks done ones to the bottom", () => {
    const rows = [
      row({ room: "Kamer 1", medicationName: "C", nextOpenTime: "12:00", doneForToday: false }),
      row({ room: "Kamer 1", medicationName: "A", nextOpenTime: null, doneForToday: true, slots: [{ time: "07:00", check: null }] }),
      row({ room: "Kamer 1", medicationName: "B", nextOpenTime: "08:00", doneForToday: false }),
    ];
    const grouped = groupMedicationOverviewByRoom(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].scheduled.map((r) => r.medicationName)).toEqual(["B", "C", "A"]);
  });

  it("puts Geen kamer after real rooms, alphabetically otherwise", () => {
    const rows = [
      row({ room: null, medicationName: "X" }),
      row({ room: "Kamer 2", medicationName: "Y" }),
      row({ room: "Kamer 1", medicationName: "Z" }),
    ];
    const grouped = groupMedicationOverviewByRoom(rows);
    expect(grouped.map((g) => g.room)).toEqual(["Kamer 1", "Kamer 2", "Geen kamer"]);
  });

  it("keeps asNeeded medications in their own alphabetical list, separate from the scheduled sort", () => {
    const rows = [
      row({ room: "Kamer 1", medicationName: "Zolpidem", asNeeded: true }),
      row({ room: "Kamer 1", medicationName: "Aspirine", asNeeded: true }),
      row({ room: "Kamer 1", medicationName: "Paracetamol", asNeeded: false, nextOpenTime: "09:00" }),
    ];
    const grouped = groupMedicationOverviewByRoom(rows);
    expect(grouped[0].asNeeded.map((r) => r.medicationName)).toEqual(["Aspirine", "Zolpidem"]);
    expect(grouped[0].scheduled.map((r) => r.medicationName)).toEqual(["Paracetamol"]);
  });
});
