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
