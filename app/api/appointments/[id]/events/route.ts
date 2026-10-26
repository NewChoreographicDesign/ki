import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { appointmentCommentSchema } from "@/lib/validations";
import { addComment, listEvents } from "@/lib/agenda";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    await requireAuth();
    const { id } = await params;
    return NextResponse.json({ events: await listEvents(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = appointmentCommentSchema.parse(await request.json());
    await addComment(session, id, data.comment);
    return NextResponse.json({ ok: true, events: await listEvents(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
