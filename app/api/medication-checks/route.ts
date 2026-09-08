import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { medicationCheckSchema } from "@/lib/validations";
import { startOfToday, parseMedicationTimes } from "@/lib/utils";

// Intentionally no PUT/DELETE: medication checks are an irreversible audit log.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { medicationId, status, comment } = medicationCheckSchema.parse(body);

    const medication = await db.medication.findUnique({ where: { id: medicationId } });
    if (!medication) {
      return NextResponse.json({ error: "Medicatie niet gevonden" }, { status: 404 });
    }

    // A check isn't linked to a specific scheduled slot (see
    // lib/medication-reminders.ts for the same sequential-pairing
    // heuristic), so the only reliable way to stop a duplicate registration
    // — two taps on "Afvinken", or the reminder banner and the medicatie
    // page both being used for the same dose — is a hard cap: once today's
    // check count reaches the number of scheduled times, nothing more can
    // be registered until tomorrow's count resets to zero.
    const times = parseMedicationTimes(medication.times);
    const todaysCheckCount = await db.medicationCheck.count({
      where: { medicationId, checkedAt: { gte: startOfToday() } },
    });
    if (todaysCheckCount >= times.length) {
      return NextResponse.json(
        { error: "Alle geplande tijden voor vandaag zijn al geregistreerd voor deze medicatie." },
        { status: 409 }
      );
    }

    const check = await db.medicationCheck.create({
      data: { medicationId, userId: session.sub, status, comment: comment || null },
    });

    return NextResponse.json({ ok: true, check });
  } catch (error) {
    return handleApiError(error);
  }
}
