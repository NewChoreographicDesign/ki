import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import {
  medicationCheckCommentSchema,
  medicationCheckStatusSchema,
  medicationCheckResetSchema,
} from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// Two very different privilege levels share this route:
// - Any authenticated user may attach/edit a comment (e.g. "tapped by
//   mistake") — this never changes the recorded status, so it doesn't
//   weaken the audit trail medication-checks/route.ts describes.
// - Only an admin may correct the status itself, and only after re-entering
//   their own birthdate (their login credential) as step-up confirmation —
//   requireAuth() only proves a valid session cookie, which on a shared
//   device could belong to whoever last logged in, not the person now
//   asking to rewrite a medical record.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.medicationCheck.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Registratie niet gevonden" }, { status: 404 });
    }

    if (typeof body.status === "string") {
      if (session.role !== Role.ADMIN) {
        return NextResponse.json({ error: "Alleen een beheerder kan de status wijzigen" }, { status: 403 });
      }
      const { status, birthDate } = medicationCheckStatusSchema.parse(body);
      const admin = await db.user.findUnique({ where: { id: session.sub } });
      const parsedBirthDate = parseDDMMYYYY(birthDate);
      if (!admin || !parsedBirthDate || admin.birthDate.getTime() !== parsedBirthDate.getTime()) {
        return NextResponse.json({ error: "Geboortedatum is onjuist" }, { status: 401 });
      }

      const check = await db.medicationCheck.update({ where: { id }, data: { status } });
      await logAudit({
        userId: session.sub,
        action: `medication-check.status-changed:${existing.status}->${status}`,
        targetType: "MedicationCheck",
        targetId: id,
      });
      return NextResponse.json({ ok: true, check });
    }

    const { comment } = medicationCheckCommentSchema.parse(body);
    const check = await db.medicationCheck.update({ where: { id }, data: { comment: comment || null } });
    return NextResponse.json({ ok: true, check });
  } catch (error) {
    return handleApiError(error);
  }
}

// Reset (delete) a wrongly logged check — frees up its slot for the day.
// Admin-only, same birthdate step-up as the status change above.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;
    const { birthDate } = medicationCheckResetSchema.parse(await request.json());

    const admin = await db.user.findUnique({ where: { id: session.sub } });
    const parsedBirthDate = parseDDMMYYYY(birthDate);
    if (!admin || !parsedBirthDate || admin.birthDate.getTime() !== parsedBirthDate.getTime()) {
      return NextResponse.json({ error: "Geboortedatum is onjuist" }, { status: 401 });
    }

    const existing = await db.medicationCheck.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Registratie niet gevonden" }, { status: 404 });
    }

    await db.medicationCheck.delete({ where: { id } });
    await logAudit({
      userId: session.sub,
      action: `medication-check.reset:${existing.status}`,
      targetType: "MedicationCheck",
      targetId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
