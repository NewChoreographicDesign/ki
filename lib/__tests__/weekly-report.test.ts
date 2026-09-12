import { describe, it, expect } from "vitest";
import { computeMissedTodosByDay, formatChangeLogDetail } from "@/lib/weekly-report";
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
