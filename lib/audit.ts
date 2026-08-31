import "server-only";
import { db } from "@/lib/db";

/**
 * Records a single accountability-trail entry. Scoped to logins and
 * sensitive writes (client/user/document/protocol/report/medication/setting
 * mutations) rather than every page view — see the AuditLog model comment
 * in schema.prisma for why. Never throws: a logging failure must not break
 * the actual request it's describing.
 */
export async function logAudit(params: {
  userId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
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
