import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { presenceBulkSchema } from "@/lib/validations";
import { assertPresenceInputValid, submitPresenceChange } from "@/lib/presence";
import type { PresenceEntry } from "@/lib/presence-shared";

// Same status for several clients (a group leaves for dagbesteding, everybody
// is back from the weekend). No conflict check: the editor is explicitly
// overriding. Every client still gets its own event and audit line.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const input = presenceBulkSchema.parse(await request.json());

    const expectedReturnAt = input.expectedReturnAt ? new Date(input.expectedReturnAt) : null;
    assertPresenceInputValid({ status: input.status, comment: input.comment, expectedReturnAt });

    const entries: PresenceEntry[] = [];
    const failed: string[] = [];
    for (const clientId of [...new Set(input.clientIds)]) {
      try {
        const { entry } = await submitPresenceChange(session, {
          clientId,
          status: input.status,
          expectedReturnAt,
          comment: input.comment,
          force: true,
        });
        entries.push(entry);
      } catch {
        // Unknown client or a transient failure: the rest still goes through.
        failed.push(clientId);
      }
    }
    return NextResponse.json({ ok: failed.length === 0, entries, failed });
  } catch (error) {
    return handleApiError(error);
  }
}
