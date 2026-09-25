import "server-only";
import { DataBreachSeverity, DataBreachStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/push";

/**
 * The technical half of the AVG (GDPR) "melding datalek" duty — a generic
 * Dutch legal obligation, not specific to any one customer. This module
 * and the DataBreachIncident/DataBreachNote models are what actually
 * tracks a reported breach: who reported it, the AVG-mandated 72-hour
 * clock, and whether the Autoriteit Persoonsgegevens and affected data
 * subjects were actually notified — not just a checklist someone might
 * follow.
 */

export const SEVERITY_LABEL: Record<DataBreachSeverity, string> = {
  LOW: "Laag",
  MEDIUM: "Middel",
  HIGH: "Hoog",
  CRITICAL: "Kritiek",
};

export const STATUS_LABEL: Record<DataBreachStatus, string> = {
  NEW: "Nieuw — nog niet beoordeeld",
  ASSESSED: "Beoordeeld",
  AP_NOTIFIED: "Gemeld bij Autoriteit Persoonsgegevens",
  DATA_SUBJECTS_NOTIFIED: "Betrokkenen geïnformeerd",
  CLOSED: "Afgesloten",
};

const AP_NOTIFICATION_DEADLINE_MS = 72 * 60 * 60 * 1000;

/**
 * The AVG Art. 33 deadline: 72 hours after the breach was DETECTED (not
 * reported/created — someone may only notice a breach some time after it
 * happened). Returns null once likelyRisk has been explicitly assessed as
 * false (the Art. 33(1) exception applies, so no deadline is running) or
 * once the AP has already been notified.
 */
export function dataBreachDeadline(incident: {
  detectedAt: Date;
  likelyRisk: boolean | null;
  apNotifiedAt: Date | null;
}): Date | null {
  if (incident.likelyRisk === false) return null;
  if (incident.apNotifiedAt) return null;
  return new Date(incident.detectedAt.getTime() + AP_NOTIFICATION_DEADLINE_MS);
}

export function isDataBreachOverdue(
  incident: { detectedAt: Date; likelyRisk: boolean | null; apNotifiedAt: Date | null },
  now: Date = new Date()
): boolean {
  const deadline = dataBreachDeadline(incident);
  return deadline !== null && deadline.getTime() < now.getTime();
}

// Any active, non-invaller role may report a datalek — whoever notices
// should be able to flag it immediately without first finding an admin.
export function canReportDataBreach(role: Role): boolean {
  return role !== Role.INVALLER;
}

// Assessing risk, notifying the AP, notifying data subjects, and closing
// the case are admin-only — the same irreversible-compliance-decision
// audience as everything else in Backend.
export function canManageDataBreach(role: Role): boolean {
  return role === Role.ADMIN;
}

/**
 * Pushes an immediate notification to every admin the moment a datalek
 * is reported — the 72-hour legal clock cannot wait for anyone to happen
 * to open the app. Goes out synchronously from the report route itself
 * (see app/api/datalek/route.ts); never throws (same "never break the
 * request it's describing" spirit as lib/push.ts itself).
 */
export async function sendUrgentDataBreachAlert(params: { title: string; reportedByName: string }): Promise<void> {
  try {
    const admins = await db.user.findMany({ where: { role: Role.ADMIN, active: true }, select: { id: true } });
    await notifyUsers(
      admins.map((a) => a.id),
      {
        title: "URGENT — Datalek gemeld",
        body: `${params.title} — gemeld door ${params.reportedByName}. De AVG-meldplicht kan een termijn van 72 uur vereisen.`,
        url: "/datalek",
      }
    );
  } catch (error) {
    console.error("[data-breach] urgent alert failed", error);
  }
}
