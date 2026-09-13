import { describe, it, expect } from "vitest";
import { renderWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { amsterdamDate } from "@/lib/utils";
import type { WeeklyReportData } from "@/lib/weekly-report";

// Actually executes pdfkit's PDF generation (not just a type-check or a
// build) — this is the one thing `next build` can never catch, since route
// code only runs on a real request. This exact gap is why a broken pdfkit
// standard-font resolution (see the DEFAULT_FONT comment in
// lib/weekly-report-pdf.ts) passed every previous local check and only
// surfaced in production.
const weekStart = amsterdamDate(2026, 1, 5);
const weekEnd = amsterdamDate(2026, 1, 12);

function buildData(): WeeklyReportData {
  return {
    weekStart,
    weekEnd,
    reports: [
      {
        id: "r1",
        date: weekStart,
        content: "Alles rustig verlopen.",
        shift: "MORNING",
        client: { firstName: "Jan", lastName: "Jansen" },
        user: { name: "Anna" },
      },
    ],
    medicationChecks: [
      {
        id: "m1",
        checkedAt: amsterdamDate(2026, 1, 5, 8),
        status: "TAKEN",
        comment: null,
        user: { name: "Anna" },
        medication: { name: "Paracetamol", client: { firstName: "Jan", lastName: "Jansen", room: "Kamer 1" } },
      },
    ],
    todos: [
      {
        daysOfWeek: "0",
        createdAt: amsterdamDate(2025, 12, 20),
        completed: false,
        completedAt: null,
        title: "Wondverzorging",
      },
    ],
    appointments: [
      {
        id: "a1",
        startAt: amsterdamDate(2026, 1, 6, 10),
        title: "Huisarts",
        client: { firstName: "Jan", lastName: "Jansen" },
        createdBy: { name: "Anna" },
      },
    ],
    changeLog: [
      {
        id: "c1",
        createdAt: amsterdamDate(2026, 1, 6, 11),
        action: "appointment.edited:tijd 10:00 -> 11:00",
        user: { name: "Anna" },
      },
    ],
  } as unknown as WeeklyReportData;
}

describe("renderWeeklyReportPdf", () => {
  it("produces a real, well-formed PDF from a full week of data", async () => {
    const pdf = await renderWeeklyReportPdf(buildData());

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1").trim()).toBe("%%EOF");
  });

  it("produces a valid PDF for an empty week too", async () => {
    const empty = buildData();
    empty.reports = [];
    empty.medicationChecks = [];
    empty.todos = [];
    empty.appointments = [];
    empty.changeLog = [];

    const pdf = await renderWeeklyReportPdf(empty);

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("respects a section filter, still producing a valid PDF", async () => {
    const pdf = await renderWeeklyReportPdf(buildData(), new Set(["medication"]));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
