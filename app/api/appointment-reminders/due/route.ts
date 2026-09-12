import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getDueAppointmentReminders } from "@/lib/appointment-reminders";

// Polled client-side (components/reminder-watcher.tsx) every 30s
// while the app is open — any authenticated role can see this, same as the
// Agenda module itself.
export async function GET() {
  try {
    await requireAuth();
    const due = await getDueAppointmentReminders();
    return NextResponse.json({ due });
  } catch (error) {
    return handleApiError(error);
  }
}
