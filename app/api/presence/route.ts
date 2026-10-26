import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { presenceChangeSchema } from "@/lib/validations";
import { loadPresenceBoard, PresenceConflictError, submitPresenceChange } from "@/lib/presence";
import { summarizePresence } from "@/lib/presence-shared";

// Live snapshot for the board (it polls while the tab is visible). Always the
// freshest state, never cached: a stale "aanwezig" is worse than no data.
export async function GET() {
  try {
    await requireAuth();
    const entries = await loadPresenceBoard();
    return NextResponse.json({ entries, summary: summarizePresence(entries), serverTime: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

// One change. A stale edit (somebody else changed this client since the
// editor loaded it) answers 409 with the current state instead of silently
// overwriting; the client may resend with force.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const input = presenceChangeSchema.parse(await request.json());

    try {
      const { entry } = await submitPresenceChange(session, {
        clientId: input.clientId,
        status: input.status,
        expectedReturnAt: input.expectedReturnAt ? new Date(input.expectedReturnAt) : null,
        comment: input.comment,
        since: input.since,
        force: input.force,
      });
      return NextResponse.json({ ok: true, entry });
    } catch (error) {
      if (error instanceof PresenceConflictError) {
        return NextResponse.json({ error: `${error.current.changedByName ?? "Een collega"} heeft dit zojuist gewijzigd`, conflict: true, current: error.current }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
