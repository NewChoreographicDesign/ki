import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const data = appointmentSchema.parse(body);

    const startAt = new Date(data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum/tijd" }, { status: 400 });
    }

    const appointment = await db.appointment.create({
      data: {
        title: data.title,
        description: data.description || null,
        clientId: data.clientId || null,
        startAt,
        createdById: session.sub,
      },
    });

    return NextResponse.json({ ok: true, appointment });
  } catch (error) {
    return handleApiError(error);
  }
}
