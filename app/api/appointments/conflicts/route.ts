import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { listConflicts, resolveTimes } from "@/lib/agenda";

// Live overlap warning while the form is open: the same cliënt in two places,
// or the same begeleider on two afspraken. A hint, never a block.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const p = request.nextUrl.searchParams;
    const allDay = p.get("allDay") === "1";
    const { start, end } = resolveTimes({ startAt: p.get("startAt") ?? "", endAt: p.get("endAt") || null, allDay });
    const conflicts = await listConflicts({
      id: p.get("exclude") || undefined,
      clientId: p.get("clientId") || null,
      assigneeId: p.get("assigneeId") || null,
      startAt: start,
      endAt: end,
      allDay,
    });
    return NextResponse.json({ conflicts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
