import "server-only";
import PDFDocument from "pdfkit";
import type { WeeklyReportData } from "@/lib/weekly-report";
import { formatDate, formatDateTime, fullName, isoWeekOf, PRIORITY_LABELS } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  TAKEN: "Afgevinkt",
  LEAVE: "Verlof",
  NOT_TAKEN: "Niet ingenomen",
};

/**
 * Renders the same weekly data as renderWeeklyReportText() (lib/weekly-report.ts)
 * as a PDF instead, for the automatically archived weekly reports (see
 * app/api/cron/weekly-report/route.ts). pdfkit is used because it needs no
 * external binary/browser (unlike a headless-Chromium approach), works on
 * Vercel's serverless Node runtime, and its built-in Helvetica font needs no
 * bundled font files.
 */
export function renderWeeklyReportPdf(data: WeeklyReportData): Promise<Buffer> {
  const { isoYear, isoWeek } = isoWeekOf(data.weekStart);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(`Weekrapport — week ${isoWeek}, ${isoYear}`);
    doc
      .fontSize(10)
      .fillColor("#555555")
      .text(`${formatDate(data.weekStart)} t/m ${formatDate(new Date(data.weekEnd.getTime() - 1))}`)
      .text(`Gegenereerd op ${formatDateTime(new Date())}`)
      .fillColor("#000000");
    doc.moveDown(1);

    section(doc, `Rapportages (${data.reports.length})`);
    if (data.reports.length === 0) {
      item(doc, "Geen rapportages deze week.");
    } else {
      for (const r of data.reports) {
        item(
          doc,
          `${formatDate(r.date)} · ${fullName(r.client)} · ${r.shift === "MORNING" ? "Ochtend" : "Avond"} · door ${r.user.name}`,
          r.content
        );
      }
    }

    section(doc, `Medicatie (${data.medicationChecks.length})`);
    if (data.medicationChecks.length === 0) {
      item(doc, "Geen medicatieregistraties deze week.");
    } else {
      for (const c of data.medicationChecks) {
        const status = STATUS_LABELS[c.status] ?? c.status;
        item(
          doc,
          `${formatDateTime(c.checkedAt)} · ${fullName(c.medication.client)} · ${c.medication.name} · ${status} · door ${c.user.name}${c.comment ? ` · ${c.comment}` : ""}`
        );
      }
    }

    section(doc, `To-do's (${data.todos.length})`);
    if (data.todos.length === 0) {
      item(doc, "Geen to-do's aangemaakt of afgerond deze week.");
    } else {
      for (const t of data.todos) {
        const status = t.completed ? `afgerond door ${t.completedBy?.name ?? "?"}` : "open";
        item(doc, `${t.title} (${PRIORITY_LABELS[t.priority]}) · ${status} · aangemaakt door ${t.createdBy.name}`);
      }
    }

    section(doc, `Afspraken (${data.appointments.length})`);
    if (data.appointments.length === 0) {
      item(doc, "Geen afspraken deze week.");
    } else {
      for (const a of data.appointments) {
        item(
          doc,
          `${formatDateTime(a.startAt)} · ${a.title}${a.client ? ` · ${fullName(a.client)}` : ""} · aangemaakt door ${a.createdBy.name}`
        );
      }
    }

    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor("#0f172a").text(title, { underline: true });
  doc.fontSize(10).fillColor("#000000");
  doc.moveDown(0.3);
}

function item(doc: PDFKit.PDFDocument, header: string, body?: string) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
  doc.fontSize(10).fillColor("#333333").text(header);
  if (body) {
    doc.fontSize(10).fillColor("#000000").text(body, { indent: 10 });
  }
  doc.moveDown(0.4);
}
