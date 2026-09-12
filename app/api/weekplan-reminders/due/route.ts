import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getDueWeekPlanReminders } from "@/lib/weekplan-reminders";

// Polled client-side (components/reminder-watcher.tsx) every 30s
// while the app is open — any authenticated role can see this, since the
// underlying weekplanning schedule is operational (who needs to do what,
// when) even though only admins can edit it in Backend.
export async function GET() {
  try {
    await requireAuth();
    const due = await getDueWeekPlanReminders();
    return NextResponse.json({ due });
  } catch (error) {
    return handleApiError(error);
  }
}
