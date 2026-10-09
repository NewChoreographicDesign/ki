import { describe, it, expect } from "vitest";
import { expandOccurrenceDates } from "../appointment-recurrence";

describe("expandOccurrenceDates", () => {
  it("returns only the first date for 'none'", () => {
    expect(expandOccurrenceDates("2026-10-07", { mode: "none" })).toEqual(["2026-10-07"]);
  });

  it("daily with a count", () => {
    expect(expandOccurrenceDates("2026-10-07", { mode: "daily", count: 3 })).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("weekly defaults to the weekday of the first date", () => {
    expect(expandOccurrenceDates("2026-10-07", { mode: "weekly", count: 3 })).toEqual(["2026-10-07", "2026-10-14", "2026-10-21"]);
  });

  it("weekly on several weekdays until a date", () => {
    // Wed 7 Oct 2026; Mon+Wed+Fri → Wed 7, Fri 9, Mon 12, Wed 14, Fri 16
    expect(expandOccurrenceDates("2026-10-07", { mode: "weekly", weekdays: [1, 3, 5], until: "2026-10-16" })).toEqual([
      "2026-10-07",
      "2026-10-09",
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
    ]);
  });

  it("biweekly skips every other week", () => {
    expect(expandOccurrenceDates("2026-10-07", { mode: "biweekly", count: 3 })).toEqual(["2026-10-07", "2026-10-21", "2026-11-04"]);
  });

  it("monthly clamps to the last day of shorter months", () => {
    expect(expandOccurrenceDates("2026-01-31", { mode: "monthly", count: 3 })).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("multiple chosen dates are merged, sorted and de-duplicated with the first", () => {
    expect(expandOccurrenceDates("2026-10-10", { mode: "dates", dates: ["2026-10-03", "2026-10-10", "2026-10-20"] })).toEqual([
      "2026-10-03",
      "2026-10-10",
      "2026-10-20",
    ]);
  });

  it("requires an end for repeating modes", () => {
    expect(() => expandOccurrenceDates("2026-10-07", { mode: "weekly" })).toThrow(RangeError);
  });

  it("caps the series length", () => {
    expect(expandOccurrenceDates("2026-10-07", { mode: "daily", count: 5000 }).length).toBe(120);
  });

  it("rejects impossible dates", () => {
    expect(() => expandOccurrenceDates("2026-02-31", { mode: "none" })).toThrow(RangeError);
  });
});
