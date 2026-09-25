import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/log";

/**
 * Records a single accountability-trail entry. Scoped to logins and
 * sensitive writes (client/user/document/protocol/report/medication/setting
 * mutations) rather than every page view — see the AuditLog model comment
 * in schema.prisma for why. Never throws: a logging failure must not break
 * the actual request it's describing.
 *
 * Every call also emits a structured `security` log line (lib/log.ts) —
 * this is the one chokepoint nearly every sensitive action in the app
 * already goes through (logins, MFA, SSO, user mutations, ...), so wiring
 * it here gives the SIEM-facing pipeline the exact same event set as the
 * in-app auditlog, with no need to touch each call site individually.
 */
export async function logAudit(params: {
  userId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  logger.security(params.action, {
    userId: params.userId,
    targetType: params.targetType,
    targetId: params.targetId,
  });
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", error);
  }
}
