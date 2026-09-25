import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { reportSchema } from "@/lib/validations";
import { parseDDMMYYYY, fullName } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/push";

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
        // See Report.adminOnly's schema.prisma comment — set once, here,
        // and never toggled any other way.
        adminOnly: session.role === Role.INVALLER,
      },
    });

    await logAudit({
      userId: session.sub,
      action: "report.create",
      targetType: "Client",
      targetId: client.id,
    });

    // Instant push to every admin, not just whenever they next open the
    // app — never blocks/fails the actual report save on a push hiccup
    // (see lib/push.ts, itself a no-op without VAPID keys configured).
    try {
      const admins = await db.user.findMany({
        where: { role: Role.ADMIN, active: true, id: { not: session.sub } },
        select: { id: true },
      });
      const preview = data.content.length > 120 ? `${data.content.slice(0, 120)}…` : data.content;
      await notifyUsers(
        admins.map((a) => a.id),
        { title: `Nieuwe rapportage — ${fullName(client)}`, body: preview, url: "/rapportage" }
      );
    } catch (error) {
      console.error("[reports] push notify failed", error);
    }

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return handleApiError(error);
  }
}
