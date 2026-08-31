import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron";

// Purges old AuditLog rows only. Deliberately does NOT touch actual care
// records (Report, MedicationCheck, Document, Protocol, Presence, ...) —
// how long those must be kept (e.g. the WGBO's medical-record retention
// rules) is a legal/policy decision for the organization, not something to
// silently automate. AuditLog is operational metadata, not a care record,
// so bounding its growth is safe.
const RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000; // ~2 years

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const { count } = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  return NextResponse.json({ ok: true, deleted: count });
}
