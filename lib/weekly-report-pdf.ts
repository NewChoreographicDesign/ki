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

// Same three variants the live app's own Badge component uses for this
// exact status (app/(app)/medicatie/[clientId]/medication-check-list.tsx),
// so a reader who knows the app's colors recognizes them instantly here —
// taken is unambiguously good (forest), a miss is unambiguously a problem
// (red — distinct from the brand's own rose accent, which is used
// everywhere else in this document and would blur into "just decoration"
// if reused as a warning color here), leave is neutral information rather
// than either (amber).
const STATUS_STYLE: Record<string, { label: string; text: string; bg: string }> = {
  TAKEN: { label: "Afgevinkt", text: "#3f6048", bg: "#e1ebe3" },
  NOT_TAKEN: { label: "Niet ingenomen", text: "#a3312a", bg: "#f6dcda" },
  LEAVE: { label: "Verlof", text: "#946322", bg: "#f5e6cd" },
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
// real font files sidesteps the standard-font machinery entirely — pdfkit
// never touches '#standard-fonts/*' for a font given as a filesystem path,
// which is loaded with an ordinary, statically traceable fs.readFileSync().
// Liberation Sans (assets/fonts/, SIL Open Font License — LICENSE-OFL.txt)
// is metrically compatible with Helvetica/Helvetica-Bold and was created
// specifically to be a freely embeddable substitute for it.
const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const REGULAR_FONT = path.join(FONT_DIR, "LiberationSans-Regular.ttf");
const BOLD_FONT = path.join(FONT_DIR, "LiberationSans-Bold.ttf");

// Vezrap system — matches tailwind.config.ts/globals.css's light palette
// (this PDF is print output, so it's always the light theme regardless of
// which theme the viewer has the app itself set to). Gold is deliberately
// left out here, same as in the app: it only ever lives inside the brand
// mark's own gradient, not as a general-purpose accent — see
// components/brand/logo.tsx.
const COLOR = {
  ink: "#1c2420",
  muted: "#5b6b72",
  faint: "#8a97a0",
  border: "#dde3dd",
  rose: "#b25a48",
  roseSoft: "#f3e2dd",
  forest: "#3f6048",
  forestSoft: "#e1ebe3",
  gradientFrom: "#ffcf6e",
  gradientTo: "#d98a7a",
  white: "#ffffff",
};

const PAGE_MARGIN = 50;
const HEADER_RULE_HEIGHT = 4;

/**
 * Renders the same weekly data as renderWeeklyReportText() (lib/weekly-report.ts)
 * as a PDF instead — used both for the automatically archived weekly
 * reports (see app/api/cron/weekly-report/route.ts) and for an on-demand
 * download of the live, still-in-progress week (see
 * app/api/weekrapport/download/route.ts). pdfkit is used because it needs
 * no external binary/browser (unlike a headless-Chromium approach) and
 * works on Vercel's serverless Node runtime.
 */
export function renderWeeklyReportPdf(
  data: WeeklyReportData,
  sections: Set<WeeklyReportSection> = new Set(WEEKLY_REPORT_SECTION_KEYS)
): Promise<Buffer> {
  const { isoYear, isoWeek } = isoWeekOf(data.weekStart);

  return new Promise((resolve, reject) => {
    // bufferPages: page numbers in the footer need the FINAL page count,
    // which isn't known until every section has been written — buffering
    // lets drawFooters() go back and stamp each already-rendered page
    // afterward instead of guessing the total up front.
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "A4", font: REGULAR_FONT, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // The constructor's own first page never fires "pageAdded" — draw its
    // top rule directly; every page after that (a section running long)
    // gets the same rule from the listener instead.
    drawTopRule(doc);
    doc.on("pageAdded", () => drawTopRule(doc));

    drawHeaderBand(doc, `Week ${isoWeek}, ${isoYear}`, [
      `${formatDate(data.weekStart)} t/m ${formatDate(new Date(data.weekEnd.getTime() - 1))}`,
    ]);
    drawStatStrip(doc, [
      { label: "Rapportages", count: data.reports.length },
      { label: "Medicatie", count: data.medicationChecks.length },
      { label: "Werklijst", count: data.todos.length },
      { label: "Afspraken", count: data.appointments.length },
      { label: "Wijzigingen", count: data.changeLog.length },
    ]);

    if (sections.has("reports")) {
      section(doc, `Rapportages (${data.reports.length})`);
      if (data.reports.length === 0) {
        emptyState(doc, "Geen rapportages deze week.");
      } else {
        data.reports.forEach((r, i) => {
          item(
            doc,
            `${formatDate(r.date)} · ${fullName(r.client)} · ${shiftLabel(r.shift)} · door ${r.user.name}`,
            r.content,
            { divider: i < data.reports.length - 1 }
          );
        });
      }
    }

    if (sections.has("medication")) {
      const notTakenCount = data.medicationChecks.filter((c) => c.status === "NOT_TAKEN").length;
      section(doc, `Medicatie (${data.medicationChecks.length})`, {
        badge:
          notTakenCount > 0
            ? { ...STATUS_STYLE.NOT_TAKEN, label: `${notTakenCount} niet ingenomen` }
            : undefined,
      });
      if (data.medicationChecks.length === 0) {
        emptyState(doc, "Geen medicatieregistraties deze week.");
      } else {
        // A fixed-width status-badge column, sized to the longest label, so
        // every check across every room/day lines up in one scannable
        // column — the badge's color is what should jump out on the page,
        // not its shifting position.
        const badgeColWidth = Math.max(
          ...Object.values(STATUS_STYLE).map((s) => badgeWidth(doc, s.label))
        );
        for (const room of groupMedicationChecksByRoomAndDay(data.medicationChecks)) {
          const roomCheckCount = room.days.reduce((n, d) => n + d.checks.length, 0);
          roomHeader(doc, `${room.room} (${roomCheckCount})`);
          for (const day of room.days) {
            miniLabel(doc, `${day.dayLabel} ${day.dateLabel}`);
            day.checks.forEach((c, i) => {
              const style = STATUS_STYLE[c.status] ?? { label: c.status, text: COLOR.muted, bg: COLOR.border };
              const due = c.scheduledTime ? `Gepland ${c.scheduledTime}` : "Indien nodig";
              medicationItem(
                doc,
                style,
                badgeColWidth,
                `${c.medication.name} — ${fullName(c.medication.client)}`,
                `${due} (geregistreerd ${formatTime(c.checkedAt)}) · door ${c.user.name}${c.comment ? ` · ${c.comment}` : ""}`,
                { divider: i < day.checks.length - 1, indent: 12 }
              );
            });
          }
        }
      }
    }

    if (sections.has("todos")) {
      section(doc, `Werklijst (${data.todos.length})`);
      if (data.todos.length === 0) {
        emptyState(doc, "Geen taken aangemaakt of afgerond deze week.");
      } else {
        const missedByDay = computeMissedTodosByDay(data.todos, data.weekStart, data.weekEnd);
        if (missedByDay.length === 0) {
          emptyState(doc, "Alle taken zijn op tijd afgerond.", { positive: true });
        } else {
          subsection(doc, "Niet gedaan, per dag");
          missedByDay.forEach((day, i) => {
            item(doc, `${day.dayLabel} ${day.dateLabel}`, day.titles.join(", "), {
              divider: i < missedByDay.length - 1,
            });
          });
        }
      }
    }

    if (sections.has("appointments")) {
      section(doc, `Afspraken (${data.appointments.length})`);
      if (data.appointments.length === 0) {
        emptyState(doc, "Geen afspraken deze week.");
      } else {
        data.appointments.forEach((a, i) => {
          item(
            doc,
            `${formatDateTime(a.startAt)} · ${a.title}${a.client ? ` · ${fullName(a.client)}` : ""} · aangemaakt door ${a.createdBy.name}`,
            undefined,
            { divider: i < data.appointments.length - 1 }
          );
        });
      }
    }

    if (sections.has("changelog")) {
      section(doc, `Wijzigingen - changelog (${data.changeLog.length})`);
      if (data.changeLog.length === 0) {
        emptyState(doc, "Geen wijzigingen aan afspraken of medicatieregistraties deze week.");
      } else {
        data.changeLog.forEach((e, i) => {
          item(
            doc,
            `${formatDateTime(e.createdAt)} · door ${e.user?.name ?? "onbekend"} · ${formatChangeLogDetail(e.action)}`,
            undefined,
            { divider: i < data.changeLog.length - 1 }
          );
        });
      }
    }

    drawFooters(doc, "Vezrap · Weekrapport");
    doc.end();
  });
}

/** A thin brand-colored rule along the very top edge of every page. */
function drawTopRule(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, doc.page.width, HEADER_RULE_HEIGHT).fill(COLOR.rose);
  doc.restore();
}

/**
 * The page-1 hero: a soft brand-gradient band (same 135° rose→gold as the
 * app's own `bg-brand-gradient`) carrying the title, a simplified take on
 * the two-ring mark (components/brand/logo.tsx has no exportable image
 * asset — pdfkit can't embed an SVG, so this redraws its two circles +
 * meeting dot directly as vector shapes instead of skipping the mark
 * entirely), and the week range. Only page 1 gets this; later pages (a
 * section running long) just keep the slim top rule from drawTopRule().
 */
function drawHeaderBand(doc: PDFKit.PDFDocument, title: string, subtitleLines: string[]) {
  const bandHeight = 92;
  const gradient = doc.linearGradient(0, 0, doc.page.width, bandHeight);
  gradient.stop(0, COLOR.gradientFrom).stop(1, COLOR.gradientTo);
  doc.save();
  doc.rect(0, HEADER_RULE_HEIGHT, doc.page.width, bandHeight - HEADER_RULE_HEIGHT).fill(gradient);
  doc.restore();

  drawMark(doc, PAGE_MARGIN + 14, bandHeight / 2 + HEADER_RULE_HEIGHT / 2, 15);

  const textLeft = PAGE_MARGIN + 46;
  doc
    .font(BOLD_FONT)
    .fontSize(11)
    .fillColor(COLOR.white)
    .text("VEZRAP", textLeft, 24, { characterSpacing: 1.5 });
  doc.font(BOLD_FONT).fontSize(20).fillColor(COLOR.white).text(`Weekrapport — ${title}`, textLeft, 40);
  doc
    .font(REGULAR_FONT)
    .fontSize(9.5)
    .fillColor(COLOR.white)
    .text(subtitleLines.join("  ·  "), textLeft, 66);

  doc.font(REGULAR_FONT).fontSize(9).fillColor(COLOR.faint).text(`Gegenereerd op ${formatDateTime(new Date())}`, PAGE_MARGIN, bandHeight + 12);
  doc.y = bandHeight + 30;
  doc.fillColor(COLOR.ink).font(REGULAR_FONT).fontSize(10);
}

/** Two overlapping rings + meeting dot, echoing components/brand/logo.tsx, drawn as plain vectors. */
function drawMark(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number) {
  doc.save();
  doc.circle(cx - r * 0.35, cy, r).lineWidth(2.5).strokeColor(COLOR.white).opacity(0.55).stroke();
  doc.opacity(1);
  doc.circle(cx + r * 0.35, cy, r * 0.92).lineWidth(3.5).strokeColor(COLOR.white).stroke();
  doc.circle(cx, cy, 2).fillColor(COLOR.white).fill();
  doc.restore();
}

/** The row of small count tiles ("Rapportages 4", "Medicatie 12", ...) beneath the header band. */
function drawStatStrip(doc: PDFKit.PDFDocument, stats: { label: string; count: number }[]) {
  const startY = doc.y;
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const gap = 10;
  const tileWidth = (contentWidth - gap * (stats.length - 1)) / stats.length;
  const tileHeight = 40;

  stats.forEach((s, i) => {
    const x = PAGE_MARGIN + i * (tileWidth + gap);
    doc.save();
    doc
      .roundedRect(x, startY, tileWidth, tileHeight, 5)
      .lineWidth(1)
      .strokeColor(COLOR.border)
      .fillColor(COLOR.roseSoft)
      .fillAndStroke(COLOR.roseSoft, COLOR.border);
    doc.restore();
    doc.font(BOLD_FONT).fontSize(15).fillColor(COLOR.rose).text(String(s.count), x, startY + 6, { width: tileWidth, align: "center" });
    doc
      .font(REGULAR_FONT)
      .fontSize(7.5)
      .fillColor(COLOR.muted)
      .text(s.label.toUpperCase(), x, startY + 25, { width: tileWidth, align: "center", characterSpacing: 0.4 });
  });

  doc.y = startY + tileHeight + 22;
  doc.fillColor(COLOR.ink).font(REGULAR_FONT).fontSize(10);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) doc.addPage();
}

function section(
  doc: PDFKit.PDFDocument,
  title: string,
  opts: { badge?: { label: string; text: string; bg: string } } = {}
) {
  ensureSpace(doc, 70);
  doc.moveDown(0.6);
  const barX = PAGE_MARGIN;
  const textX = PAGE_MARGIN + 10;
  const y = doc.y;
  doc.font(BOLD_FONT).fontSize(13);
  const textHeight = doc.heightOfString(title, { width: doc.page.width - PAGE_MARGIN * 2 - 10 });
  doc.rect(barX, y + 1, 4, Math.max(textHeight - 2, 12)).fill(COLOR.rose);
  doc.fillColor(COLOR.ink).text(title, textX, y);
  // A right-aligned badge on the section's own title row — e.g. "N niet
  // ingenomen" on Medicatie — surfaces the one number that actually needs
  // attention before a reader has to scan every room and day below it.
  if (opts.badge) {
    const w = badgeWidth(doc, opts.badge.label);
    drawBadge(doc, opts.badge.label, doc.page.width - PAGE_MARGIN - w, y - 1, opts.badge.text, opts.badge.bg, w);
  }
  doc.moveDown(0.15);
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .lineWidth(0.75)
    .strokeColor(COLOR.border)
    .stroke();
  doc.moveDown(0.5);
  doc.font(REGULAR_FONT).fontSize(10).fillColor(COLOR.ink);
}

/** A sub-heading within a section, e.g. "Niet gedaan, per dag" under Werklijst. */
function subsection(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 50);
  doc.moveDown(0.25);
  doc.font(BOLD_FONT).fontSize(10.5).fillColor(COLOR.forest).text(title.toUpperCase(), { characterSpacing: 0.3 });
  doc.moveDown(0.2);
  doc.font(REGULAR_FONT).fontSize(10).fillColor(COLOR.ink);
}

/**
 * A room header within Medicatie: a full-width filled band rather than
 * subsection()'s plain text line, so one room's block of checks reads as
 * visually separate from the next at a glance — a plain bold label here
 * blended into the surrounding text too easily once every check row below
 * it already carries its own colored status badge.
 */
function roomHeader(doc: PDFKit.PDFDocument, title: string) {
  const bandHeight = 20;
  ensureSpace(doc, bandHeight + 40);
  doc.moveDown(0.75);
  const y = doc.y;
  const width = doc.page.width - PAGE_MARGIN * 2;
  doc.save();
  doc.roundedRect(PAGE_MARGIN, y, width, bandHeight, 3).fill(COLOR.forestSoft);
  doc.restore();
  doc
    .font(BOLD_FONT)
    .fontSize(9.5)
    .fillColor(COLOR.forest)
    .text(title.toUpperCase(), PAGE_MARGIN + 10, y + 5.5, { characterSpacing: 0.4, lineBreak: false });
  doc.y = y + bandHeight + 10;
  doc.font(REGULAR_FONT).fontSize(10).fillColor(COLOR.ink);
}

/** A smaller, muted label below a subsection — e.g. a day within a room. */
function miniLabel(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 30);
  doc.font(BOLD_FONT).fontSize(9.5).fillColor(COLOR.muted).text(title);
  doc.moveDown(0.15);
  doc.font(REGULAR_FONT).fontSize(10).fillColor(COLOR.ink);
}

function item(
  doc: PDFKit.PDFDocument,
  header: string,
  body?: string,
  opts: { divider?: boolean; indent?: number } = {}
) {
  ensureSpace(doc, 40);
  const indent = opts.indent ?? 0;
  doc.font(BOLD_FONT).fontSize(9.5).fillColor(COLOR.ink).text(header, PAGE_MARGIN + indent, doc.y, {
    width: doc.page.width - PAGE_MARGIN * 2 - indent,
  });
  if (body) {
    doc.moveDown(0.1);
    doc
      .font(REGULAR_FONT)
      .fontSize(9.5)
      .fillColor(COLOR.muted)
      .text(body, PAGE_MARGIN + indent + 8, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 - indent - 8 });
  }
  doc.moveDown(0.35);
  if (opts.divider) {
    doc
      .moveTo(PAGE_MARGIN + indent, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();
    doc.moveDown(0.35);
  }
}

const BADGE_HEIGHT = 14;
const BADGE_FONT_SIZE = 7.5;

/** The pill width a given label needs at the badge font, plus its padding — used to size and align a column of badges. */
function badgeWidth(doc: PDFKit.PDFDocument, label: string): number {
  doc.font(BOLD_FONT).fontSize(BADGE_FONT_SIZE);
  return doc.widthOfString(label.toUpperCase(), { characterSpacing: 0.3 }) + 14;
}

/** A small rounded, colored status pill — the same rounded-full/soft-background/colored-text shape as the live app's own Badge component (components/ui/badge.tsx). */
function drawBadge(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  textColor: string,
  bg: string,
  width: number
) {
  doc.save();
  doc.roundedRect(x, y, width, BADGE_HEIGHT, BADGE_HEIGHT / 2).fill(bg);
  doc.restore();
  doc
    .font(BOLD_FONT)
    .fontSize(BADGE_FONT_SIZE)
    .fillColor(textColor)
    .text(label.toUpperCase(), x, y + 3.6, { width, align: "center", characterSpacing: 0.3, lineBreak: false });
}

/**
 * A medication check row: a fixed-width, color-coded status badge (forest
 * "Afgevinkt" / red "Niet ingenomen" / amber "Verlof" — see STATUS_STYLE)
 * in its own left column, so a reader scanning down a room's checks sees
 * the taken/missed/leave pattern in color before reading a single word,
 * with the medication + client as the prominent header text beside it and
 * the scheduling/registration detail secondary underneath.
 */
function medicationItem(
  doc: PDFKit.PDFDocument,
  style: { label: string; text: string; bg: string },
  badgeColWidth: number,
  header: string,
  meta: string,
  opts: { divider?: boolean; indent?: number } = {}
) {
  ensureSpace(doc, 44);
  const indent = opts.indent ?? 0;
  const x = PAGE_MARGIN + indent;
  const y = doc.y;
  drawBadge(doc, style.label, x, y, style.text, style.bg, badgeColWidth);

  const textX = x + badgeColWidth + 10;
  const textWidth = doc.page.width - PAGE_MARGIN - textX;
  doc.font(BOLD_FONT).fontSize(9.5).fillColor(COLOR.ink).text(header, textX, y - 1, { width: textWidth });
  doc.moveDown(0.1);
  doc.font(REGULAR_FONT).fontSize(9).fillColor(COLOR.muted).text(meta, textX, doc.y, { width: textWidth });

  doc.y = Math.max(doc.y, y + BADGE_HEIGHT);
  doc.moveDown(0.35);
  if (opts.divider) {
    doc
      .moveTo(x, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();
    doc.moveDown(0.35);
  }
}

function emptyState(doc: PDFKit.PDFDocument, text: string, opts: { positive?: boolean } = {}) {
  ensureSpace(doc, 30);
  doc
    .font(REGULAR_FONT)
    .fontSize(9.5)
    .fillColor(opts.positive ? COLOR.forest : COLOR.faint)
    .text(text);
  doc.moveDown(0.4);
  doc.fillColor(COLOR.ink);
}

/** Stamps "brandLabel · Pagina X van Y" on every already-rendered page — done last, once the true page count is known. */
/** Exported for lib/__tests__/weekly-report-pdf.test.ts — not meant to be called from outside this module otherwise. */
export function drawFooters(doc: PDFKit.PDFDocument, brandLabel: string) {
  const range = doc.bufferedPageRange();
  // Every footer sits inside the bottom margin, i.e. past the boundary
  // pdfkit's own auto-pagination watches — left alone, each .text() call
  // below would see itself "overflowing" the page and silently call
  // doc.addPage() to make room, quietly appending a blank page per
  // footer (and leaving the "van N" count stale, since it was computed
  // from bufferedPageRange() before those extra pages existed). Swallowing
  // addPage() for the duration of this loop is the standard pdfkit
  // workaround: we're placing text ourselves at an exact, intentional
  // coordinate, so the auto-break it would otherwise trigger is never
  // wanted here.
  const originalAddPage = doc.addPage.bind(doc);
  doc.addPage = () => doc;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 16;
    doc
      .moveTo(PAGE_MARGIN, y - 8)
      .lineTo(doc.page.width - PAGE_MARGIN, y - 8)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();
    doc.font(REGULAR_FONT).fontSize(8).fillColor(COLOR.faint).text(brandLabel, PAGE_MARGIN, y, { lineBreak: false });
    doc
      .font(REGULAR_FONT)
      .fontSize(8)
      .fillColor(COLOR.faint)
      .text(`Pagina ${i - range.start + 1} van ${range.count}`, PAGE_MARGIN, y, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: "right",
        lineBreak: false,
      });
  }
  doc.addPage = originalAddPage;
}
