import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { sendAppointmentReminder } from "@/lib/email";
import { fullName } from "@/lib/utils";

// Sends a reminder for appointments starting within the next 24 hours that
// have not been reminded about yet, then marks them as sent.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await db.appointment.findMany({
    where: { reminderSent: false, startAt: { gte: now, lt: windowEnd } },
    include: { client: true },
  });

  for (const appointment of appointments) {
    await sendAppointmentReminder({
      title: appointment.title,
      description: appointment.description,
      clientName: appointment.client ? fullName(appointment.client) : null,
      startAt: appointment.startAt,
    });
    await db.appointment.update({ where: { id: appointment.id }, data: { reminderSent: true } });
  }

  return NextResponse.json({ ok: true, remindersSent: appointments.length });
}
