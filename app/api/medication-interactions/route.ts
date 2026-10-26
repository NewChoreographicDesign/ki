import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkClient } from "@/lib/interaction-data";
import { DECISION_SUPPORT_NOTICE } from "@/lib/medication-interactions";

// Interactions and possible double therapy among one client's active
// medication, from the imported licensed extract only. Readable by every
// signed-in role (they all give medication); acknowledging is a separate,
// restricted route. Without an imported extract the answer is just
// `dataset: null` — nothing else is computed or shown.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const clientId = request.nextUrl.searchParams.get("clientId") ?? "";
    if (!clientId) return NextResponse.json({ error: "clientId ontbreekt" }, { status: 400 });
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    const check = await checkClient(clientId);
    return NextResponse.json({ ok: true, notice: DECISION_SUPPORT_NOTICE, ...check });
  } catch (error) {
    return handleApiError(error);
  }
}
