import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { importInteractions } from "@/lib/interaction-data";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  source: z.string().trim().min(1).max(100),
  // The version or date of the licensed extract, shown next to every finding.
  version: z.string().trim().min(1).max(100),
  csv: z.string().min(1).max(50_000_000),
  // From which severity rank an acknowledgement is required. Default: the highest rank in the file.
  ackFromRank: z.number().int().min(1).max(999).optional(),
});

// Admin only: a licensed dataset this app has no licence of its own for.
// Replaces the previous extract.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const data = schema.parse(await request.json());
    const result = await importInteractions(data);
    await logAudit({ userId: session.sub, action: "medication_interactions.import", targetType: "InteractionDataset" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
