import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { loadPresenceHistory } from "@/lib/presence";

export async function GET(_request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    await requireAuth();
    const { clientId } = await params;
    const history = await loadPresenceHistory(clientId);
    if (!history) return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    return NextResponse.json(history, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
