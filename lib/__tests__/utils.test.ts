import { describe, it, expect } from "vitest";
import {
  parseDDMMYYYY,
  formatDDMMYYYY,
  isSameDay,
  fullName,
  determineShiftType,
  shiftEndForStart,
} from "@/lib/utils";
import { ShiftType } from "@prisma/client";

describe("parseDDMMYYYY", () => {
  it("parses a valid date", () => {
    const date = parseDDMMYYYY("12-05-1985");
    expect(date).not.toBeNull();
    expect(date?.getUTCFullYear()).toBe(1985);
    expect(date?.getUTCMonth()).toBe(4);
    expect(date?.getUTCDate()).toBe(12);
  });

  it("rejects malformed input", () => {
    expect(parseDDMMYYYY("1985-05-12")).toBeNull();
    expect(parseDDMMYYYY("not-a-date")).toBeNull();
    expect(parseDDMMYYYY("")).toBeNull();
  });

  it("rejects impossible dates", () => {
    expect(parseDDMMYYYY("31-02-2024")).toBeNull();
    expect(parseDDMMYYYY("32-01-2024")).toBeNull();
    expect(parseDDMMYYYY("00-01-2024")).toBeNull();
  });

  it("round-trips with formatDDMMYYYY", () => {
    const date = parseDDMMYYYY("03-11-1990");
    expect(date).not.toBeNull();
    expect(formatDDMMYYYY(date as Date)).toBe("03-11-1990");
  });
});

describe("isSameDay", () => {
  it("returns true for the same calendar day", () => {
    expect(isSameDay(new Date(2026, 0, 1, 3), new Date(2026, 0, 1, 23))).toBe(true);
  });

  it("returns false for different days", () => {
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
  });
});

describe("fullName", () => {
  it("joins first and last name", () => {
    expect(fullName({ firstName: "Anna", lastName: "Jansen" })).toBe("Anna Jansen");
  });
});

describe("determineShiftType", () => {
  it("returns MORNING between 07:00 and 15:00", () => {
    expect(determineShiftType(new Date(2026, 0, 1, 7, 0))).toBe(ShiftType.MORNING);
    expect(determineShiftType(new Date(2026, 0, 1, 14, 59))).toBe(ShiftType.MORNING);
  });

  it("returns EVENING between 15:00 and 23:00", () => {
    expect(determineShiftType(new Date(2026, 0, 1, 15, 0))).toBe(ShiftType.EVENING);
    expect(determineShiftType(new Date(2026, 0, 1, 22, 59))).toBe(ShiftType.EVENING);
  });

  it("treats night hours as evening continuation", () => {
    expect(determineShiftType(new Date(2026, 0, 1, 2, 0))).toBe(ShiftType.EVENING);
    expect(determineShiftType(new Date(2026, 0, 1, 23, 30))).toBe(ShiftType.EVENING);
  });
});

describe("shiftEndForStart", () => {
  it("ends the morning shift at 15:00 the same day", () => {
    const start = new Date(2026, 0, 1, 8, 0);
    const end = shiftEndForStart(ShiftType.MORNING, start);
    expect(end.getHours()).toBe(15);
    expect(end.getDate()).toBe(1);
  });

  it("ends the evening shift at 23:00 the same day", () => {
    const start = new Date(2026, 0, 1, 15, 0);
    const end = shiftEndForStart(ShiftType.EVENING, start);
    expect(end.getHours()).toBe(23);
    expect(end.getDate()).toBe(1);
  });

  it("rolls over to the next day for a late-night start", () => {
    const start = new Date(2026, 0, 1, 23, 30);
    const end = shiftEndForStart(ShiftType.EVENING, start);
    expect(end.getDate()).toBe(2);
    expect(end.getHours()).toBe(23);
  });
});
