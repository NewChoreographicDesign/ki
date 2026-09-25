import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, canAccessAuditLog, AuthError } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

// Turns an automated AuditReviewFinding into an actual "controle" event —
// someone with audit-log access has read it and acknowledged it, closing
// the loop the periodic review (lib/audit-review.ts) only opens.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!canAccessAuditLog(session.role)) {
      throw new AuthError("Geen toegang", 403);
    }
    const { id } = await params;

    const finding = await db.auditReviewFinding.findUnique({ where: { id } });
    if (!finding) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }
    if (finding.resolved) {
      return NextResponse.json({ ok: true });
    }

    await db.auditReviewFinding.update({
      where: { id },
      data: { resolved: true, resolvedByUserId: session.sub, resolvedAt: new Date() },
    });

    await logAudit({ userId: session.sub, action: "audit_finding.resolve", targetType: "AuditReviewFinding", targetId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
