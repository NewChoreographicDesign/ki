import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseDDMMYYYY, DEFAULT_EMPLOYEE_BIRTH_DATE } from "@/lib/utils";

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["ADMIN", "COORDINATOR", "EMPLOYEE"]).optional(),
  // Sets the birthdate back to the well-known default and clears any active
  // lockout, so a medewerker who forgot the real birthdate they set
  // themselves (at /account) can log back in immediately and pick a new
  // one — the 15-minute login lockout on its own doesn't help with that,
  // since retrying a forgotten value is never going to succeed regardless
  // of how long they wait.
  resetBirthDate: z.literal(true).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;
    const { resetBirthDate, ...rest } = patchSchema.parse(await request.json());

    const data: Prisma.UserUpdateInput = { ...rest };
    if (resetBirthDate) {
      data.birthDate = parseDDMMYYYY(DEFAULT_EMPLOYEE_BIRTH_DATE)!;
      data.failedLoginAttempts = 0;
      data.lockedUntil = null;
    }

    const user = await db.user.update({ where: { id }, data });
    await logAudit({
      userId: session.sub,
      action: resetBirthDate ? "user.reset-birthdate" : "user.update",
      targetType: "User",
      targetId: id,
    });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}

// Only safe when the account never actually recorded anything — reports,
// medication checks, presence entries, created to-do's and appointments,
// and shifts all cascade-delete along with their User (see schema.prisma),
// which would silently destroy real care records for anyone who's actually
// worked a shift. "Deactiveren" (already supported) is the correct way to
// retire an account with history; this only covers a mistakenly created or
// genuinely never-used account.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const { id } = await params;

    if (id === session.sub) {
      return NextResponse.json({ error: "Je kunt je eigen account niet verwijderen" }, { status: 400 });
    }

    const existing = await db.user.findUnique({
      where: { id },
      select: {
        _count: {
          select: { reports: true, medicationChecks: true, presences: true, todosCreated: true, appointments: true, shifts: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
    }
    const hasHistory = Object.values(existing._count).some((count) => count > 0);
    if (hasHistory) {
      return NextResponse.json(
        {
          error:
            "Deze medewerker heeft al gegevens geregistreerd en kan niet verwijderd worden — gebruik Deactiveren.",
        },
        { status: 409 }
      );
    }

    await db.user.delete({ where: { id } });
    await logAudit({ userId: session.sub, action: "user.delete", targetType: "User", targetId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
