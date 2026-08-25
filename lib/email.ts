import "server-only";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, fullName } from "@/lib/utils";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

/** Settings table is the single source of truth; env vars are the fallback for first boot. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const setting = await db.setting.findUnique({ where: { key } });
  if (setting) return setting.value;
  return process.env[key] ?? fallback;
}

async function sendEmail(opts: { to: string | string[]; subject: string; html: string }) {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set, skipping email: "${opts.subject}"`);
    return { skipped: true };
  }
  const from = process.env.EMAIL_FROM || "Woongroep Admin <noreply@example.com>";
  try {
    return await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
  } catch (error) {
    console.error("[email] send failed", error);
    return { error };
  }
}

export async function sendReportEmail(params: {
  clientName: string;
  userName: string;
  shift: string;
  date: Date;
  content: string;
}) {
  const to = await getSetting("GENERAL_EMAIL");
  if (!to) return;
  const html = `
    <h2>Nieuwe rapportage</h2>
    <p><strong>Cliënt:</strong> ${escapeHtml(params.clientName)}</p>
    <p><strong>Dienst:</strong> ${params.shift === "MORNING" ? "Ochtend" : "Avond"}</p>
    <p><strong>Datum:</strong> ${formatDate(params.date)}</p>
    <p><strong>Door:</strong> ${escapeHtml(params.userName)}</p>
    <hr />
    <p>${escapeHtml(params.content).replace(/\n/g, "<br />")}</p>
  `;
  await sendEmail({ to, subject: `Rapportage ${params.clientName} - ${formatDate(params.date)}`, html });
}

export async function sendMonthlyMedicationOverview() {
  const to = await getSetting("GENERAL_EMAIL");
  if (!to) return;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const checks = await db.medicationCheck.findMany({
    where: { checkedAt: { gte: start, lt: end } },
    include: { medication: { include: { client: true } }, user: true },
    orderBy: { checkedAt: "asc" },
  });

  const rows = checks
    .map(
      (c) => `<tr>
        <td>${formatDateTime(c.checkedAt)}</td>
        <td>${escapeHtml(fullName(c.medication.client))}</td>
        <td>${escapeHtml(c.medication.name)}</td>
        <td>${escapeHtml(c.user.name)}</td>
        <td>${escapeHtml(c.comment ?? "")}</td>
      </tr>`
    )
    .join("");

  const html = `
    <h2>Maandelijks medicatie-overzicht</h2>
    <p>Periode: ${formatDate(start)} - ${formatDate(end)}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Tijdstip</th><th>Cliënt</th><th>Medicatie</th><th>Afgevinkt door</th><th>Opmerking</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">Geen registraties</td></tr>`}</tbody>
    </table>
  `;

  await sendEmail({ to, subject: `Maandelijks medicatie-overzicht - ${formatDate(start)}`, html });
}

export async function sendMonthlyTodosOverview() {
  const to = await getSetting("COORDINATOR_EMAIL");
  if (!to) return;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const todos = await db.todo.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { createdBy: true, completedBy: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = todos
    .map(
      (t) => `<tr>
        <td>${escapeHtml(t.title)}</td>
        <td>${t.priority}</td>
        <td>${t.completed ? "Afgerond" : "Open"}</td>
        <td>${escapeHtml(t.createdBy.name)}</td>
        <td>${t.completedBy ? escapeHtml(t.completedBy.name) : ""}</td>
      </tr>`
    )
    .join("");

  const html = `
    <h2>Maandelijks to-do overzicht</h2>
    <p>Periode: ${formatDate(start)} - ${formatDate(end)}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Taak</th><th>Prioriteit</th><th>Status</th><th>Aangemaakt door</th><th>Afgerond door</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">Geen taken</td></tr>`}</tbody>
    </table>
  `;

  await sendEmail({ to, subject: `Maandelijks to-do overzicht - ${formatDate(start)}`, html });
}

export async function sendAppointmentReminder(params: {
  title: string;
  description?: string | null;
  clientName?: string | null;
  startAt: Date;
}) {
  const to = await getSetting("GENERAL_EMAIL");
  if (!to) return;
  const html = `
    <h2>Herinnering: afspraak</h2>
    <p><strong>${escapeHtml(params.title)}</strong></p>
    ${params.clientName ? `<p><strong>Cliënt:</strong> ${escapeHtml(params.clientName)}</p>` : ""}
    <p><strong>Wanneer:</strong> ${formatDateTime(params.startAt)}</p>
    ${params.description ? `<p>${escapeHtml(params.description)}</p>` : ""}
  `;
  await sendEmail({ to, subject: `Herinnering: ${params.title}`, html });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
