import { describe, it, expect } from "vitest";
import {
  ALLOWANCE_SOON_THRESHOLD_MS,
  compareAllowanceUrgency,
  effectiveAllowanceState,
  formatCountdown,
  formatDurationCoarse,
  remainingMs,
  totalAllowanceMs,
  type AllowanceData,
  type AllowanceTimingFields,
} from "@/lib/allowances-shared";

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);

function duration(overrides: Partial<AllowanceTimingFields> = {}): AllowanceTimingFields {
  return {
    status: "RUNNING",
    mode: "DURATION",
    allottedMs: 30 * MIN,
    endsAt: null,
    startAt: null,
    usedMs: 0,
    sessionStartedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

function until(overrides: Partial<AllowanceTimingFields> = {}): AllowanceTimingFields {
  return {
    status: "RUNNING",
    mode: "UNTIL",
    allottedMs: null,
    endsAt: new Date(NOW + HOUR).toISOString(),
    startAt: null,
    usedMs: 0,
    sessionStartedAt: null,
    ...overrides,
  };
}

describe("remainingMs", () => {
  it("counts down a running DURATION allowance from allottedMs minus the elapsed session", () => {
    const a = duration({ sessionStartedAt: new Date(NOW - 10 * MIN).toISOString() });
    expect(remainingMs(a, NOW)).toBe(20 * MIN);
  });

  it("folds already-banked usedMs into a running DURATION allowance's remaining time", () => {
    const a = duration({ usedMs: 5 * MIN, sessionStartedAt: new Date(NOW - 10 * MIN).toISOString() });
    expect(remainingMs(a, NOW)).toBe(15 * MIN);
  });

  it("a PAUSED DURATION allowance's remaining time ignores the clock — only usedMs counts", () => {
    const a = duration({ status: "PAUSED", usedMs: 12 * MIN, sessionStartedAt: null });
    expect(remainingMs(a, NOW)).toBe(18 * MIN);
  });

  it("an UNTIL allowance's remaining time is just the deadline minus now, regardless of status", () => {
    const a = until();
    expect(remainingMs(a, NOW)).toBe(HOUR);
    expect(remainingMs(a, NOW + 2 * HOUR)).toBe(-HOUR);
  });
});

describe("effectiveAllowanceState", () => {
  it("is 'running' well before the limit, 'soon' inside the warning window, 'expired' past it", () => {
    expect(effectiveAllowanceState(duration({ sessionStartedAt: new Date(NOW - 10 * MIN).toISOString() }), NOW)).toBe("running");
    expect(effectiveAllowanceState(duration({ sessionStartedAt: new Date(NOW - 27 * MIN).toISOString() }), NOW)).toBe("soon");
    expect(effectiveAllowanceState(duration({ sessionStartedAt: new Date(NOW - 31 * MIN).toISOString() }), NOW)).toBe("expired");
  });

  it("'soon' applies to UNTIL mode too — a deadline five minutes away is as worth flagging as a timer", () => {
    const a = until({ endsAt: new Date(NOW + ALLOWANCE_SOON_THRESHOLD_MS - 1000).toISOString() });
    expect(effectiveAllowanceState(a, NOW)).toBe("soon");
  });

  it("never derives EXPIRED for anything but a running allowance that ran out — PAUSED/SCHEDULED/COMPLETED pass through as stored", () => {
    expect(effectiveAllowanceState(duration({ status: "PAUSED" }), NOW)).toBe("paused");
    expect(effectiveAllowanceState(duration({ status: "SCHEDULED" }), NOW)).toBe("scheduled");
    expect(effectiveAllowanceState(duration({ status: "COMPLETED" }), NOW)).toBe("completed");
  });
});

describe("totalAllowanceMs", () => {
  it("is allottedMs for DURATION mode", () => {
    expect(totalAllowanceMs(duration({ allottedMs: 45 * MIN }), new Date(NOW).toISOString())).toBe(45 * MIN);
  });

  it("is endsAt minus createdAt for UNTIL mode", () => {
    const createdAt = new Date(NOW - 20 * MIN).toISOString();
    expect(totalAllowanceMs(until({ endsAt: new Date(NOW + 40 * MIN).toISOString() }), createdAt)).toBe(60 * MIN);
  });
});

describe("formatCountdown", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatCountdown(5 * MIN + 30_000)).toBe("5:30");
  });

  it("formats an hour or more as h:mm:ss", () => {
    expect(formatCountdown(HOUR + 2 * MIN + 5_000)).toBe("1:02:05");
  });

  it("shows a negative (over time) countdown with a leading minus", () => {
    expect(formatCountdown(-(3 * MIN + 12_000))).toBe("-3:12");
  });
});

describe("formatDurationCoarse", () => {
  it("drops the unit that's zero", () => {
    expect(formatDurationCoarse(45 * MIN)).toBe("45 min");
    expect(formatDurationCoarse(2 * HOUR)).toBe("2 uur");
    expect(formatDurationCoarse(2 * HOUR + 15 * MIN)).toBe("2u 15m");
  });
});

describe("compareAllowanceUrgency", () => {
  function row(overrides: Partial<AllowanceData>): AllowanceData {
    return {
      id: "a",
      clientId: "c",
      clientName: "Cliënt",
      clientRoom: null,
      type: "PHONE",
      note: null,
      createdByName: "Staff",
      createdAt: new Date(NOW).toISOString(),
      completedAt: null,
      ...duration(),
      ...overrides,
    };
  }

  it("within the same running group, less time left sorts first", () => {
    const soon = row({ id: "soon", sessionStartedAt: new Date(NOW - 29 * MIN).toISOString() });
    const later = row({ id: "later", sessionStartedAt: new Date(NOW - 5 * MIN).toISOString() });
    expect(compareAllowanceUrgency(soon, later, NOW)).toBeLessThan(0);
  });

  it("completed rows sort most-recently-completed first", () => {
    const earlier = row({ id: "e", status: "COMPLETED", completedAt: new Date(NOW - 2 * HOUR).toISOString() });
    const recent = row({ id: "r", status: "COMPLETED", completedAt: new Date(NOW - 10 * MIN).toISOString() });
    expect(compareAllowanceUrgency(recent, earlier, NOW)).toBeLessThan(0);
  });
});
