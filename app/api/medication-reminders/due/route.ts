import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getDueMedicationReminders } from "@/lib/medication-reminders";

// Polled client-side (components/medication-reminder-watcher.tsx) every 30s
// while the app is open — any authenticated role can see this, same as the
// Medicatie module itself.
export async function GET() {
  try {
    await requireAuth();
    const due = await getDueMedicationReminders();
    return NextResponse.json({ due });
  } catch (error) {
    return handleApiError(error);
  }
}
