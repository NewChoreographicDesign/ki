import "server-only";
import { AuditFindingSeverity, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/log";
import { notifyUsers } from "@/lib/push";

/**
 * The periodic, non-reactive half of "controle van logboeken": scans the
 * last 24 hours of AuditLog for patterns that look like unauthorized
 * access, and writes one AuditReviewRun row EVERY time it runs (whether
 * or not it finds anything) — that row is what makes the process
 * demonstrable to an external auditor, not just a description of intent.
 * Run daily (see vercel.json), but callable at any cadence — always scans
 * a fixed trailing 24-hour window rather than "since last run", so a
 * missed invocation only means a wider gap, never a silently skipped day.
 *
 * Deliberately simple, threshold-based heuristics rather than a "smart"
 * anomaly detector: each one maps to a concrete, explainable question an
 * auditor would actually ask ("did anyone try to brute-force a login?")
 * — a finding an admin reads on /backend/audit should always be
 * traceable back to one plain sentence.
 */

const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_MFA_THRESHOLD = 5;

type FindingInput = {
  category: string;
  severity: AuditFindingSeverity;
  summary: string;
};

export async function runAuditReview(now: Date = new Date()): Promise<{ runId: string; findingsCount: number }> {
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const run = await db.auditReviewRun.create({ data: { windowStart, windowEnd } });

  const findings: FindingInput[] = [];

  // 1. Failed logins — brute-force / credential-guessing attempts against
  // naam+geboortedatum.
  const failedLogins = await db.auditLog.count({
    where: { action: "login.failed", createdAt: { gte: windowStart, lte: windowEnd } },
  });
  if (failedLogins >= FAILED_LOGIN_THRESHOLD) {
    findings.push({
      category: "FAILED_LOGINS",
      severity: failedLogins >= FAILED_LOGIN_THRESHOLD * 2 ? AuditFindingSeverity.HIGH : AuditFindingSeverity.MEDIUM,
      summary: `${failedLogins} mislukte inlogpogingen in de afgelopen 24 uur.`,
    });
  }

  // 2. Failed MFA codes — someone with the right naam+geboortedatum
  // repeatedly guessing the second factor.
  const failedMfa = await db.auditLog.count({
    where: { action: "login.mfa.failed", createdAt: { gte: windowStart, lte: windowEnd } },
  });
  if (failedMfa >= FAILED_MFA_THRESHOLD) {
    findings.push({
      category: "FAILED_MFA",
      severity: AuditFindingSeverity.HIGH,
      summary: `${failedMfa} mislukte pogingen met tweestapsverificatie in de afgelopen 24 uur.`,
    });
  }

  if (findings.length > 0) {
    await db.auditReviewFinding.createMany({ data: findings.map((f) => ({ runId: run.id, ...f })) });
    await db.auditReviewRun.update({ where: { id: run.id }, data: { findingsCount: findings.length } });

    // Each finding also goes out as a `security` log line — unlike the
    // push notification below (only reaches subscribed admins), this is
    // what lets a SIEM alert on the same anomaly independent of this
    // app's own UI.
    for (const f of findings) {
      logger.security("audit_review.finding", { category: f.category, severity: f.severity, summary: f.summary, runId: run.id });
    }

    const admins = await db.user.findMany({ where: { role: Role.ADMIN, active: true }, select: { id: true } });
    await notifyUsers(
      admins.map((a) => a.id),
      {
        title: "Periodieke logcontrole",
        body: `${findings.length} aandachtspunt${findings.length === 1 ? "" : "en"} gevonden.`,
        url: "/backend/audit",
      }
    ).catch(() => {});
  }

  logger.info("audit_review.run", { runId: run.id, findingsCount: findings.length });

  return { runId: run.id, findingsCount: findings.length };
}
