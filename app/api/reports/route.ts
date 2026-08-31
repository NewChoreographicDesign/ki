import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { reportSchema } from "@/lib/validations";
import { parseDDMMYYYY } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const data = reportSchema.parse(body);

    const date = parseDDMMYYYY(data.date);
    if (!date) {
      return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: "Cliënt niet gevonden" }, { status: 404 });
    }

    const report = await db.report.create({
      data: {
        clientId: data.clientId,
        userId: session.sub,
        shift: data.shift,
        date,
        content: data.content,
      },
    });

    await logAudit({
      userId: session.sub,
      action: "report.create",
      targetType: "Client",
      targetId: client.id,
    });

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return handleApiError(error);
  }
}
