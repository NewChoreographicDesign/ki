import { describe, it, expect } from "vitest";
import {
  computeMissedTodosByDay,
  formatChangeLogDetail,
  groupMedicationChecksByRoomAndDay,
  parseWeeklyReportSections,
  WEEKLY_REPORT_SECTION_KEYS,
} from "@/lib/weekly-report";
import { amsterdamDate } from "@/lib/utils";

type TestTodo = {
  daysOfWeek: string;
  createdAt: Date;
  completed: boolean;
  completedAt: Date | null;
  title: string;
};

// Monday 05-01-2026 through the following Monday - a full calendar week.
const weekStart = amsterdamDate(2026, 1, 5);
const weekEnd = amsterdamDate(2026, 1, 12);
const beforeWeek = amsterdamDate(2025, 12, 20);

describe("computeMissedTodosByDay", () => {
  it("flags every scheduled day a never-completed task was due", () => {
    const todo: TestTodo = {
      daysOfWeek: "0,2,4", // Mon, Wed, Fri
      createdAt: beforeWeek,
      completed: false,
      completedAt: null,
      title: "Wondverzorging",
    };

    const missed = computeMissedTodosByDay([todo], weekStart, weekEnd);

    expect(missed.map((d) => d.dateLabel)).toEqual(["05-01-2026", "07-01-2026", "09-01-2026"]);
    expect(missed.every((d) => d.titles.includes("Wondverzorging"))).toBe(true);
  });

  it("does not flag a task completed before its due day ended", () => {
    const todo: TestTodo = {
      daysOfWeek: "0", // Monday only
      createdAt: beforeWeek,
      completed: true,
      completedAt: new Date(weekStart.getTime() + 3 * 3_600_000), // Monday, a few hours in
      title: "Bloeddruk meten",
    };

    const missed = computeMissedTodosByDay([todo], weekStart, weekEnd);
    expect(missed).toHaveLength(0);
  });

  it("flags a task completed only after its due day had already ended", () => {
    const todo: TestTodo = {
      daysOfWeek: "0", // Monday only
      createdAt: beforeWeek,
      completed: true,
      completedAt: new Date(weekStart.getTime() + 24 * 3_600_000 + 3_600_000), // Tuesday
      title: "Bloeddruk meten",
    };

    const missed = computeMissedTodosByDay([todo], weekStart, weekEnd);
    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ dateLabel: "05-01-2026", titles: ["Bloeddruk meten"] });
  });

  it("ignores a task that didn't exist yet on its scheduled day", () => {
    const todo: TestTodo = {
      daysOfWeek: "2", // Wednesday
      createdAt: amsterdamDate(2026, 1, 8), // created the Thursday after
      completed: false,
      completedAt: null,
      title: "Nieuwe taak",
    };

    const missed = computeMissedTodosByDay([todo], weekStart, weekEnd);
    expect(missed).toHaveLength(0);
  });

  it("lists multiple missed tasks on the same day together", () => {
    const todoA: TestTodo = {
      daysOfWeek: "0",
      createdAt: beforeWeek,
      completed: false,
      completedAt: null,
      title: "Taak A",
    };
    const todoB: TestTodo = {
      daysOfWeek: "0",
      createdAt: beforeWeek,
      completed: false,
      completedAt: null,
      title: "Taak B",
    };

    const missed = computeMissedTodosByDay([todoA, todoB], weekStart, weekEnd);
    expect(missed).toHaveLength(1);
    expect(missed[0].titles).toEqual(["Taak A", "Taak B"]);
  });
});

type TestCheck = {
  id: string;
  checkedAt: Date;
  status: "TAKEN" | "NOT_TAKEN" | "LEAVE";
  comment: string | null;
  user: { name: string };
  medicationId: string;
  medication: { name: string; times: string; asNeeded: boolean; client: { room: string | null } };
};

function makeCheck(overrides: Partial<TestCheck> & { id: string; checkedAt: Date }): TestCheck {
  return {
    status: "TAKEN",
    comment: null,
    user: { name: "Anna" },
    medicationId: "med-1",
    medication: { name: "Paracetamol", times: "08:00", asNeeded: false, client: { room: "Kamer 1" } },
    ...overrides,
  };
}

describe("groupMedicationChecksByRoomAndDay", () => {
  it("groups checks by room, then by day within each room", () => {
    const monday = amsterdamDate(2026, 1, 5, 8);
    const tuesday = amsterdamDate(2026, 1, 6, 8);
    const checks = [
      makeCheck({ id: "1", checkedAt: monday, medicationId: "A", medication: { name: "A", times: "08:00", asNeeded: false, client: { room: "Kamer 1" } } }),
      makeCheck({ id: "2", checkedAt: monday, medicationId: "B", medication: { name: "B", times: "08:00", asNeeded: false, client: { room: "Kamer 2" } } }),
      makeCheck({ id: "3", checkedAt: tuesday, medicationId: "A", medication: { name: "A", times: "08:00", asNeeded: false, client: { room: "Kamer 1" } } }),
    ];

    const grouped = groupMedicationChecksByRoomAndDay(checks as unknown as Parameters<typeof groupMedicationChecksByRoomAndDay>[0]);

    expect(grouped.map((r) => r.room)).toEqual(["Kamer 1", "Kamer 2"]);
    expect(grouped[0].days).toHaveLength(2);
    expect(grouped[0].days[0].checks.map((c) => c.id)).toEqual(["1"]);
    expect(grouped[0].days[1].checks.map((c) => c.id)).toEqual(["3"]);
    expect(grouped[1].days[0].checks.map((c) => c.id)).toEqual(["2"]);
  });

  it("puts clients with no room under Geen kamer, after real rooms", () => {
    const day = amsterdamDate(2026, 1, 5, 8);
    const checks = [
      makeCheck({ id: "1", checkedAt: day, medicationId: "A", medication: { name: "A", times: "08:00", asNeeded: false, client: { room: null } } }),
      makeCheck({ id: "2", checkedAt: day, medicationId: "B", medication: { name: "B", times: "08:00", asNeeded: false, client: { room: "Kamer 1" } } }),
    ];

    const grouped = groupMedicationChecksByRoomAndDay(checks as unknown as Parameters<typeof groupMedicationChecksByRoomAndDay>[0]);

    expect(grouped.map((r) => r.room)).toEqual(["Kamer 1", "Geen kamer"]);
  });

  it("pairs each check with its medication's own scheduled time, not just when it was registered", () => {
    const morning = amsterdamDate(2026, 1, 5, 8, 15);
    const evening = amsterdamDate(2026, 1, 5, 20, 5);
    const checks = [
      makeCheck({
        id: "1",
        checkedAt: morning,
        medicationId: "med-1",
        medication: { name: "Paracetamol", times: "08:00,20:00", asNeeded: false, client: { room: "Kamer 1" } },
      }),
      makeCheck({
        id: "2",
        checkedAt: evening,
        medicationId: "med-1",
        medication: { name: "Paracetamol", times: "08:00,20:00", asNeeded: false, client: { room: "Kamer 1" } },
      }),
    ];

    const grouped = groupMedicationChecksByRoomAndDay(checks as unknown as Parameters<typeof groupMedicationChecksByRoomAndDay>[0]);

    expect(grouped[0].days[0].checks.map((c) => c.scheduledTime)).toEqual(["08:00", "20:00"]);
  });

  it("leaves scheduledTime null for an asNeeded (indien nodig) medication", () => {
    const day = amsterdamDate(2026, 1, 5, 14);
    const checks = [
      makeCheck({
        id: "1",
        checkedAt: day,
        medicationId: "med-2",
        medication: { name: "Paracetamol", times: "", asNeeded: true, client: { room: "Kamer 1" } },
      }),
    ];

    const grouped = groupMedicationChecksByRoomAndDay(checks as unknown as Parameters<typeof groupMedicationChecksByRoomAndDay>[0]);

    expect(grouped[0].days[0].checks[0].scheduledTime).toBeNull();
  });

  it("resets the schedule pairing on a new day", () => {
    const mondayMorning = amsterdamDate(2026, 1, 5, 8, 10);
    const tuesdayMorning = amsterdamDate(2026, 1, 6, 8, 5);
    const checks = [
      makeCheck({
        id: "1",
        checkedAt: mondayMorning,
        medicationId: "med-1",
        medication: { name: "Paracetamol", times: "08:00,20:00", asNeeded: false, client: { room: "Kamer 1" } },
      }),
      makeCheck({
        id: "2",
        checkedAt: tuesdayMorning,
        medicationId: "med-1",
        medication: { name: "Paracetamol", times: "08:00,20:00", asNeeded: false, client: { room: "Kamer 1" } },
      }),
    ];

    const grouped = groupMedicationChecksByRoomAndDay(checks as unknown as Parameters<typeof groupMedicationChecksByRoomAndDay>[0]);

    expect(grouped[0].days[0].checks[0].scheduledTime).toBe("08:00");
    expect(grouped[0].days[1].checks[0].scheduledTime).toBe("08:00");
  });
});

describe("parseWeeklyReportSections", () => {
  it("returns every section when no query value is given", () => {
    expect(parseWeeklyReportSections(null)).toEqual(new Set(WEEKLY_REPORT_SECTION_KEYS));
  });

  it("returns only the requested, recognized sections", () => {
    expect(parseWeeklyReportSections("medication,todos")).toEqual(new Set(["medication", "todos"]));
  });

  it("ignores unknown keys", () => {
    expect(parseWeeklyReportSections("medication,bogus")).toEqual(new Set(["medication"]));
  });

  it("falls back to every section when nothing recognized is given", () => {
    expect(parseWeeklyReportSections("bogus")).toEqual(new Set(WEEKLY_REPORT_SECTION_KEYS));
  });
});

describe("formatChangeLogDetail", () => {
  it("strips the prefix off an appointment edit", () => {
    expect(formatChangeLogDetail('appointment.edited:titel "A" -> "B"')).toBe('titel "A" -> "B"');
  });

  it("translates a medication status change to Dutch labels", () => {
    expect(formatChangeLogDetail("medication-check.status-changed:TAKEN->NOT_TAKEN")).toBe(
      "medicatiestatus Afgevinkt -> Niet ingenomen"
    );
  });

  it("translates a medication check reset", () => {
    expect(formatChangeLogDetail("medication-check.reset:NOT_TAKEN")).toBe(
      "medicatieregistratie verwijderd (was: Niet ingenomen)"
    );
  });

  it("falls back to the raw action for anything unrecognized", () => {
    expect(formatChangeLogDetail("something.else")).toBe("something.else");
  });
});
