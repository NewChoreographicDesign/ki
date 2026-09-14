import "server-only";
import path from "path";
import PDFDocument from "pdfkit";
import {
  groupMedicationChecksByRoomAndDay,
  computeMissedTodosByDay,
  formatChangeLogDetail,
  WEEKLY_REPORT_SECTION_KEYS,
  type WeeklyReportData,
  type WeeklyReportSection,
} from "@/lib/weekly-report";
import { formatDate, formatDateTime, formatTime, fullName, isoWeekOf, shiftLabel } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  TAKEN: "Afgevinkt",
  LEAVE: "Verlof",
  NOT_TAKEN: "Niet ingenomen",
};

// pdfkit's built-in "standard 14" fonts (Helvetica etc.) are resolved
// through a package.json "imports" subpath (#standard-fonts/*) rather than
// a plain relative require(). That subpath is resolved against the package
// boundary of whichever file does the requiring, which webpack's bundling
// breaks — pdfkit's code no longer runs from inside node_modules/pdfkit/
// once bundled into a page's own chunk, so Node can't find a package.json
// with a matching "imports" field for it at all. That's an unfixable
// mismatch between pdfkit's font-loading mechanism and Next.js's bundler,
// not a missing-file problem (outputFileTracingIncludes doesn't help: the
// files being present is irrelevant once Node no longer recognizes the
// call as originating from inside the pdfkit package). Embedding our own
// real font file sidesteps the standard-font machinery entirely — pdfkit
// never touches '#standard-fonts/*' for a font given as a filesystem path,
// which is loaded with an ordinary, statically traceable fs.readFileSync().
// Liberation Sans (assets/fonts/, SIL Open Font License — LICENSE-OFL.txt)
// is metrically compatible with Helvetica and was created specifically to
// be a freely embeddable substitute for it.
const DEFAULT_FONT = path.join(process.cwd(), "assets/fonts/LiberationSans-Regular.ttf");

/**
 * Renders the same weekly data as renderWeeklyReportText() (lib/weekly-report.ts)
 * as a PDF instead, for the automatically archived weekly reports (see
 * app/api/cron/weekly-report/route.ts). pdfkit is used because it needs no
 * external binary/browser (unlike a headless-Chromium approach) and works
 * on Vercel's serverless Node runtime.
 */
export function renderWeeklyReportPdf(
  data: WeeklyReportData,
  sections: Set<WeeklyReportSection> = new Set(WEEKLY_REPORT_SECTION_KEYS)
): Promise<Buffer> {
  const { isoYear, isoWeek } = isoWeekOf(data.weekStart);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", font: DEFAULT_FONT });
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

    if (sections.has("reports")) {
      section(doc, `Rapportages (${data.reports.length})`);
      if (data.reports.length === 0) {
        item(doc, "Geen rapportages deze week.");
      } else {
        for (const r of data.reports) {
          item(
            doc,
            `${formatDate(r.date)} · ${fullName(r.client)} · ${shiftLabel(r.shift)} · door ${r.user.name}`,
            r.content
          );
        }
      }
    }

    if (sections.has("medication")) {
      section(doc, `Medicatie (${data.medicationChecks.length})`);
      if (data.medicationChecks.length === 0) {
        item(doc, "Geen medicatieregistraties deze week.");
      } else {
        for (const room of groupMedicationChecksByRoomAndDay(data.medicationChecks)) {
          subsection(doc, room.room);
          for (const day of room.days) {
            item(doc, `${day.dayLabel} ${day.dateLabel}`);
            for (const c of day.checks) {
              const status = STATUS_LABELS[c.status] ?? c.status;
              item(
                doc,
                `    ${formatTime(c.checkedAt)} · ${fullName(c.medication.client)} · ${c.medication.name} · ${status} · door ${c.user.name}${c.comment ? ` · ${c.comment}` : ""}`
              );
            }
          }
        }
      }
    }

    if (sections.has("todos")) {
      section(doc, `Werklijst (${data.todos.length})`);
      if (data.todos.length === 0) {
        item(doc, "Geen taken aangemaakt of afgerond deze week.");
      } else {
        const missedByDay = computeMissedTodosByDay(data.todos, data.weekStart, data.weekEnd);
        if (missedByDay.length === 0) {
          item(doc, "Alle taken zijn op tijd afgerond.");
        } else {
          subsection(doc, "Niet gedaan, per dag");
          for (const day of missedByDay) {
            item(doc, `${day.dayLabel} ${day.dateLabel}`, day.titles.join(", "));
          }
        }
      }
    }

    if (sections.has("appointments")) {
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
    }

    if (sections.has("changelog")) {
      section(doc, `Wijzigingen - changelog (${data.changeLog.length})`);
      if (data.changeLog.length === 0) {
        item(doc, "Geen wijzigingen aan afspraken of medicatieregistraties deze week.");
      } else {
        for (const e of data.changeLog) {
          item(doc, `${formatDateTime(e.createdAt)} · door ${e.user?.name ?? "onbekend"} · ${formatChangeLogDetail(e.action)}`);
        }
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

/** A day-name + date header within a section, e.g. splitting Medicatie by day. */
function subsection(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 50) doc.addPage();
  doc.moveDown(0.2);
  doc.fontSize(11).fillColor("#1e293b").text(title, { indent: 0 });
  doc.fontSize(10).fillColor("#000000");
  doc.moveDown(0.15);
}

function item(doc: PDFKit.PDFDocument, header: string, body?: string) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
  doc.fontSize(10).fillColor("#333333").text(header);
  if (body) {
    doc.fontSize(10).fillColor("#000000").text(body, { indent: 10 });
  }
  doc.moveDown(0.4);
}
