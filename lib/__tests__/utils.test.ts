import { describe, it, expect } from "vitest";
import {
  parseDDMMYYYY,
  formatDDMMYYYY,
  isSameDay,
  fullName,
  determineShiftType,
  shiftEndForStart,
  amsterdamDate,
  mostRecentThursdayStart,
  mostRecentMondayStart,
  todayDayOfWeek,
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

// All times below are Europe/Amsterdam wall-clock via amsterdamDate(), not
// server-local time — determineShiftType/shiftEndForStart convert through
// that same timezone, so tests must too (Jan 1, 2026 is CET, UTC+1).
describe("determineShiftType", () => {
  it("returns MORNING between 07:00 and 15:00", () => {
    expect(determineShiftType(amsterdamDate(2026, 1, 1, 7, 0))).toBe(ShiftType.MORNING);
    expect(determineShiftType(amsterdamDate(2026, 1, 1, 14, 59))).toBe(ShiftType.MORNING);
  });

  it("returns EVENING between 15:00 and 23:00", () => {
    expect(determineShiftType(amsterdamDate(2026, 1, 1, 15, 0))).toBe(ShiftType.EVENING);
    expect(determineShiftType(amsterdamDate(2026, 1, 1, 22, 59))).toBe(ShiftType.EVENING);
  });

  it("treats night hours as evening continuation", () => {
    expect(determineShiftType(amsterdamDate(2026, 1, 1, 2, 0))).toBe(ShiftType.EVENING);
    expect(determineShiftType(amsterdamDate(2026, 1, 1, 23, 30))).toBe(ShiftType.EVENING);
  });
});

describe("shiftEndForStart", () => {
  it("ends the morning shift at 15:00 the same day", () => {
    const start = amsterdamDate(2026, 1, 1, 8, 0);
    const end = shiftEndForStart(ShiftType.MORNING, start);
    expect(end.getTime()).toBe(amsterdamDate(2026, 1, 1, 15, 0).getTime());
  });

  it("ends the evening shift at 23:00 the same day", () => {
    const start = amsterdamDate(2026, 1, 1, 15, 0);
    const end = shiftEndForStart(ShiftType.EVENING, start);
    expect(end.getTime()).toBe(amsterdamDate(2026, 1, 1, 23, 0).getTime());
  });

  it("rolls over to the next day for a late-night start", () => {
    const start = amsterdamDate(2026, 1, 1, 23, 30);
    const end = shiftEndForStart(ShiftType.EVENING, start);
    expect(end.getTime()).toBe(amsterdamDate(2026, 1, 2, 23, 0).getTime());
  });

  it("handles the summer-time (CEST, UTC+2) offset correctly", () => {
    const start = amsterdamDate(2026, 7, 1, 8, 0);
    const end = shiftEndForStart(ShiftType.MORNING, start);
    expect(end.getTime()).toBe(amsterdamDate(2026, 7, 1, 15, 0).getTime());
  });
});

describe("mostRecentThursdayStart", () => {
  it("returns the same day when today is Thursday", () => {
    // 2026-01-01 is a Thursday.
    const now = amsterdamDate(2026, 1, 1, 10, 0);
    expect(mostRecentThursdayStart(now).getTime()).toBe(amsterdamDate(2026, 1, 1).getTime());
  });

  it("returns the previous Thursday for a later day in the week", () => {
    // 2026-01-04 is a Sunday; the preceding Thursday is 2026-01-01.
    const now = amsterdamDate(2026, 1, 4, 10, 0);
    expect(mostRecentThursdayStart(now).getTime()).toBe(amsterdamDate(2026, 1, 1).getTime());
  });
});

describe("mostRecentMondayStart", () => {
  it("returns the same day when today is Monday", () => {
    // 2026-01-05 is a Monday.
    const now = amsterdamDate(2026, 1, 5, 10, 0);
    expect(mostRecentMondayStart(now).getTime()).toBe(amsterdamDate(2026, 1, 5).getTime());
  });

  it("returns the previous Monday for a later day in the week", () => {
    // 2026-01-08 is a Thursday; the preceding Monday is 2026-01-05.
    const now = amsterdamDate(2026, 1, 8, 10, 0);
    expect(mostRecentMondayStart(now).getTime()).toBe(amsterdamDate(2026, 1, 5).getTime());
  });
});

describe("todayDayOfWeek", () => {
  it("returns 0 for Monday and 6 for Sunday (not JS's native convention)", () => {
    // 2026-01-05 is a Monday, 2026-01-11 is the following Sunday.
    expect(todayDayOfWeek(amsterdamDate(2026, 1, 5, 12))).toBe(0);
    expect(todayDayOfWeek(amsterdamDate(2026, 1, 11, 12))).toBe(6);
  });
});
